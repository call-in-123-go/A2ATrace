import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";
import express from "express";

export default async function startDashboard() {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE!;
    const configDir = path.join(homeDir, ".a2a");
    const configPath = path.join(configDir, "config.json");
    const agentsPath = path.join(configDir, "agents.json");
    const dockerComposePath = path.join(configDir, "docker-compose.yml");

    if (!(await fs.pathExists(configPath))) {
      console.error(chalk.red("❌ Missing global config.json — run `a2a init` first"));
      process.exit(1);
    }

    const config = await fs.readJson(configPath);

    // Start docker compose in detached mode
    console.log(chalk.blue("🐳 Starting telemetry stack..."));
    await execa("docker", ["compose", "-f", dockerComposePath, "up", "-d"], {
      stdio: "inherit",
    });

    console.log(chalk.green("✅ Telemetry stack running!"));
    console.log(chalk.gray("   Prometheus:"), `http://localhost:${config.ports.prometheus}`);
    console.log(chalk.gray("   Loki:"), `http://localhost:${config.ports.loki}`);
    console.log(chalk.gray("   Tempo:"), `http://localhost:${config.ports.tempo}`);
    console.log(chalk.gray("   Collector HTTP:"), config.collector.endpointHttp);

    // 🔹 Start Express server
    const app = express();
    const dashboardPort = config.ports.dashboard || 4000;

    // API route
    app.get("/api/config", async (_req, res) => {
      let agents: any[] = [];
      if (await fs.pathExists(agentsPath)) {
        agents = await fs.readJson(agentsPath);
      }
      res.json({
        telemetry: {
          prometheusUrl: `http://localhost:${config.ports.prometheus}`,
          lokiUrl: `http://localhost:${config.ports.loki}`,
          tempoUrl: `http://localhost:${config.ports.tempo}`,
          collectorHttp: config.collector.endpointHttp,
          collectorGrpc: config.collector.endpointGrpc,
        },
        agents,
      });
    });

    // 🔹 Serve React dashboard build
    const frontendPath = path.join(__dirname, "../../client/dist");
    app.use(express.static(frontendPath));

    // SPA fallback to index.html
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendPath, "index.html"));
    });

    app.listen(dashboardPort, () => {
      console.log(
        chalk.cyan(`🌐 Dashboard running at http://localhost:${dashboardPort}`)
      );
    });
  } catch (err) {
    console.error(chalk.red("❌ Failed to start dashboard stack:"), err);
  }
}
