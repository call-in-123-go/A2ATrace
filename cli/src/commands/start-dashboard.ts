import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';

// ✅ ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Always resolve relative to package root (cli/)
const packageRoot = path.resolve(__dirname, '../..');

/**
 * Uses 'docker compose port' to find the dynamically mapped host port for a service.
 * @param composeFile Path to the docker-compose.yml file.
 * @param serviceName The name of the service in the compose file (e.g., 'prometheus').
 * @param internalPort The internal port the service exposes (e.g., 9090).
 * @returns The dynamically mapped host port, or undefined if detection fails.
 */
async function getHostPort(
  composeFile: string,
  serviceName: string,
  internalPort: number
): Promise<number | undefined> {
  try {
    // Command: docker compose -f <composeFile> port <serviceName> <internalPort>
    const { stdout } = await execa('docker', [
      'compose',
      '-f',
      composeFile,
      'port',
      serviceName,
      String(internalPort),
    ]);

    // stdout is expected to be in the format "0.0.0.0:<port>" or "<host>:<port>". We extract the port.
    const portMatch = stdout.trim().match(/:(\d+)$/);

    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      // console.log(chalk.cyan(`🔄 Detected host port for ${serviceName}:${internalPort} is ${port}`));
      return port;
    }
    return undefined;
  } catch (error) {
    // Suppress detailed error log unless needed for debugging, use warn
    // console.warn(chalk.yellow(`⚠️ Warning: Could not auto-detect host port for ${serviceName}:${internalPort}. Error: ${error.message}`));
    return undefined;
  }
}

export default async function startDashboard() {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE!;
    const configDir = path.join(homeDir, '.a2a');
    const configPath = path.join(configDir, 'config.json');
    const agentsPath = path.join(configDir, 'agents.json');
    const dockerComposePath = path.join(configDir, 'docker-compose.yml');

    // Ensure config exists
    if (!(await fs.pathExists(configPath))) {
      console.error(
        chalk.red('❌ Missing global config.json — run `a2a init` first')
      );
      process.exit(1);
    }

    // Load config (we will mutate this object with the dynamic port)
    const config = await fs.readJson(configPath);

    // Start docker compose
    console.log(chalk.blue('🐳 Starting telemetry stack...'));
    await execa('docker', ['compose', '-f', dockerComposePath, 'up', '-d'], {
      stdio: 'inherit',
    });

    // --- DYNAMIC PORT DETECTION ---

    // 1. Prometheus (Service: prometheus, Internal Port: 9090)
    const dynamicPrometheusPort = await getHostPort(
      dockerComposePath,
      'prometheus',
      9090
    );
    if (dynamicPrometheusPort) {
      config.ports.prometheus = dynamicPrometheusPort;
    }

    // 2. Loki (Service: loki, Internal Port: 3100)
    const dynamicLokiPort = await getHostPort(dockerComposePath, 'loki', 3100);
    if (dynamicLokiPort) {
      config.ports.loki = dynamicLokiPort;
    }

    // 3. Tempo HTTP (Service: tempo, Internal Port: 3200)
    const dynamicTempoHttpPort = await getHostPort(
      dockerComposePath,
      'tempo',
      3200
    );
    if (dynamicTempoHttpPort) {
      config.ports.tempoHttp = dynamicTempoHttpPort;
    }

    // 4. Collector OTLP HTTP (Service: otel-collector, Internal Port: 4318)
    const dynamicCollectorHttpPort = await getHostPort(
      dockerComposePath,
      'otel-collector',
      4318
    );
    if (dynamicCollectorHttpPort) {
      // CRITICAL: Update the entire endpoint string
      config.collector.endpointHttp = `http://localhost:${dynamicCollectorHttpPort}/v1/traces`;
    }

    // 5. Collector OTLP gRPC (Service: otel-collector, Internal Port: 4317)
    const dynamicCollectorGrpcPort = await getHostPort(
      dockerComposePath,
      'otel-collector',
      4317
    );
    if (dynamicCollectorGrpcPort) {
      // CRITICAL: Update the entire endpoint string
      config.collector.endpointGrpc = `localhost:${dynamicCollectorGrpcPort}`;
    }

    // If any port was dynamically detected, log the override for clarity.
    const allDetectedPorts = [
      dynamicPrometheusPort,
      dynamicLokiPort,
      dynamicTempoHttpPort,
      dynamicCollectorHttpPort,
      dynamicCollectorGrpcPort,
    ].filter((p) => p !== undefined);
    if (allDetectedPorts.length > 0) {
      console.log(
        chalk.cyan(
          `🔄 Dynamically detected and overriding ${allDetectedPorts.length} host port(s).`
        )
      );
    } else {
      console.warn(
        chalk.yellow(
          `⚠️ No dynamic ports detected. Using configured ports. Ensure services are running.`
        )
      );
    }
    // ----------------------------

    console.log(chalk.green('✅ Telemetry stack running!'));
    // Use the potentially updated config.ports for logging
    console.log(
      chalk.gray('   Prometheus:'),
      `http://localhost:${config.ports.prometheus}`
    );
    console.log(
      chalk.gray('   Loki:'),
      `http://localhost:${config.ports.loki}`
    );
    console.log(
      chalk.gray('   Tempo HTTP:'),
      `http://localhost:${config.ports.tempoHttp}`
    );
    console.log(
      chalk.gray('   Tempo gRPC:'),
      `${config.collector.endpointGrpc}`
    );

    console.log(
      chalk.gray('   Collector HTTP:'),
      config.collector.endpointHttp
    );
    console.log(
      chalk.gray('   Collector GRPC:'),
      config.collector.endpointGrpc
    );

    // 🔹 Start Express server
    const app = express();
    const dashboardPort = config.ports.dashboard || 4000;

    // NEW: common middleware for API
    app.use(cors());
    app.use(express.json({ limit: '2mb' }));

    // =========================
    // API: Config for client
    // =========================
    // This endpoint now returns the dynamically detected ports
    app.get('/api/config', async (_req, res) => {
      let agents: any[] = [];
      if (await fs.pathExists(agentsPath)) {
        agents = await fs.readJson(agentsPath);
      }
      res.json({
        telemetry: {
          // This uses the dynamically updated ports
          prometheusUrl: `http://localhost:${config.ports.prometheus}`,
          lokiUrl: `http://localhost:${config.ports.loki}`,
          tempoUrl: `http://localhost:${config.ports.tempoHttp}`,
          collectorHttp: config.collector.endpointHttp,
          collectorGrpc: config.collector.endpointGrpc,
        },
        agents,
      });
    });

    // =========================
    // NEW: Loki proxy routes
    // =========================
    // Loki port now relies on the dynamically set port
    const lokiPort = config?.ports?.loki;
    if (!lokiPort) {
      console.warn(
        chalk.yellow(
          '⚠️ ports.loki missing in config; Loki routes will not work'
        )
      );
    } else {
      const lokiBase = `http://localhost:${lokiPort}`;

      // Label values (e.g., service_name)
      app.get('/api/logs/labels/:name/values', async (req, res) => {
        try {
          const url = new URL(
            `${lokiBase}/loki/api/v1/label/${encodeURIComponent(
              req.params.name
            )}/values`
          );
          const r = await fetch(url);
          const data = await r.json();
          res.json(data); // { status, data: string[] }
        } catch (e) {
          res.status(500).json({ error: String(e) });
        }
      });

      // Series discovery (optional)
      app.get('/api/logs/series', async (req, res) => {
        try {
          const endMs = Number(req.query.end ?? Date.now());
          const startMs = Number(req.query.start ?? endMs - 5 * 60_000);
          const url = new URL(`${lokiBase}/loki/api/v1/series`);
          url.searchParams.set('start', String(startMs * 1_000_000)); // ms -> ns
          url.searchParams.set('end', String(endMs * 1_000_000));
          const match = req.query.match;
          if (Array.isArray(match))
            match.forEach((m) => url.searchParams.append('match[]', String(m)));
          else if (match) url.searchParams.append('match[]', String(match));
          const r = await fetch(url);
          const data = await r.json();
          res.json(data); // { status, data: Array<Record<string,string>> }
        } catch (e) {
          res.status(500).json({ error: String(e) });
        }
      });

      // Instant query (point-in-time)
      app.get('/api/logs/query', async (req, res) => {
        try {
          const url = new URL(`${lokiBase}/loki/api/v1/query`);
          if (req.query.query)
            url.searchParams.set('query', String(req.query.query));
          if (req.query.time)
            url.searchParams.set('time', String(req.query.time)); // RFC3339 or ns
          const r = await fetch(url);
          const data = await r.json();
          res.json(data);
        } catch (e) {
          res.status(500).json({ error: String(e) });
        }
      });

      // Range query (best for UI lists / polling)
      app.get('/api/logs/query_range', async (req, res) => {
        try {
          const endMs = Number(req.query.end ?? Date.now());
          const startMs = Number(req.query.start ?? endMs - 5 * 60_000); // default 5m
          const limit = String(req.query.limit ?? '500');
          const dir = String(req.query.direction ?? 'backward'); // or "forward"
          const query = String(req.query.query ?? '{}'); // LogQL selector + pipes

          const url = new URL(`${lokiBase}/loki/api/v1/query_range`);
          url.searchParams.set('query', query);
          url.searchParams.set('start', String(startMs * 1_000_000)); // ms -> ns
          url.searchParams.set('end', String(endMs * 1_000_000));
          url.searchParams.set('limit', limit);
          url.searchParams.set('direction', dir);

          const r = await fetch(url);
          const data = await r.json();
          res.json(data);
        } catch (e) {
          res.status(500).json({ error: String(e) });
        }
      });
    }

    // =========================
    // Serve React dashboard build
    // =========================
    let frontendPath = path.join(packageRoot, 'client-dist'); // Published package
    if (!(await fs.pathExists(frontendPath))) {
      // Fallback for monorepo dev mode
      frontendPath = path.join(packageRoot, '../client/dist');
    }

    console.log('DEBUG: __dirname =', __dirname);
    console.log('DEBUG: checking frontendPath =', frontendPath);

    if (await fs.pathExists(frontendPath)) {
      console.log(chalk.green('✅ Serving frontend from:'), frontendPath);
      app.use(express.static(frontendPath));
      app.get(/.*/, (_req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    } else {
      console.warn(
        chalk.yellow('⚠️ No frontend build found — running in API-only mode')
      );
    } 

    // Start server
    app.listen(dashboardPort, () => {
      console.log(
        chalk.cyan(`🌐 Dashboard running at http://localhost:${dashboardPort}`)
      );
    });
  } catch (err) {
    console.error(chalk.red('❌ Failed to start dashboard stack:'), err);
  }
}
  