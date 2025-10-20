import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import findPort from 'find-open-port';

export default async function init() {
  const homeDir = process.env.HOME || process.env.USERPROFILE!;
  const configDir = path.join(homeDir, '.a2a');
  const configPath = path.join(configDir, 'config.json');
  const collectorPath = path.join(configDir, 'collector-config.yaml');
  const prometheusPath = path.join(configDir, 'prometheus.yml');
  const tempoPath = path.join(configDir, 'tempo.yaml');
  const dockerComposePath = path.join(configDir, 'docker-compose.yml');

  await fs.ensureDir(configDir);

  // 🔹 Pick dynamic HOST ports
  const collectorHttpPort = await findPort({ start: 4318 });
  const collectorGrpcPort = await findPort({ start: 55680 }); // collector uses 55680 internally
  const promExporterPort = await findPort({ start: 9464 });
  const promUiPort = await findPort({ start: 9090 });
  const lokiPort = await findPort({ start: 3100 });
  const tempoPort = await findPort({ start: 3200 }); // tempo UI
  const dashboardPort = await findPort({ start: 4000 });

  // 🔹 Global config.json (always overwrite)
  const token = randomUUID();
  const config = {
    collector: {
      endpointHttp: `http://localhost:${collectorHttpPort}/v1/traces`,
      endpointGrpc: `http://localhost:${collectorGrpcPort}`,
      token,
    },
    ports: {
      prometheus: promUiPort,
      loki: lokiPort,
      tempo: tempoPort,
      prometheusExporter: promExporterPort,
      dashboard: dashboardPort,
    },
  };
  await fs.writeJson(configPath, config, { spaces: 2 });
  console.log(
    chalk.green('✅ Wrote global config.json with dynamic collector endpoints')
  );

  // 🔹 Collector config (always overwrite)
  const collectorYaml = `
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:55680   # use 55680 inside container

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"
  otlp:
    endpoint: "tempo:4317"        # send traces to tempo's gRPC
    tls:
      insecure: true

processors:
  batch:

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
`;
  await fs.writeFile(collectorPath, collectorYaml, 'utf8');
  console.log(chalk.green('✅ Wrote collector-config.yaml'));

  // 🔹 Prometheus config (always overwrite)
  const prometheusYaml = `
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "a2a-agents"
    static_configs:
      - targets: ["otel-collector:8889"]
`;
  await fs.writeFile(prometheusPath, prometheusYaml, 'utf8');
  console.log(chalk.green('✅ Wrote prometheus.yml'));

  // 🔹 Tempo config (always overwrite)
  const tempoYaml = `
server:
  http_listen_port: 3200
  grpc_listen_port: 4317   # tempo owns 4317 internally

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
        http:

ingester:
  trace_idle_period: 10s
  max_block_bytes: 1_000_000
  max_block_duration: 5m

compactor:
  compaction:
    compaction_window: 1h

storage:
  trace:
    backend: local
    wal:
      path: /tmp/tempo/wal
    local:
      path: /tmp/tempo/blocks
`;
  await fs.writeFile(tempoPath, tempoYaml, 'utf8');
  console.log(chalk.green('✅ Wrote tempo.yaml'));

  // 🔹 Docker Compose (always overwrite)
  const dockerYaml = `
version: "3.8"

services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ${collectorPath}:/etc/otel-collector-config.yaml
    ports:
      - "${collectorGrpcPort}:55680"   # host dynamic → container 55680
      - "${collectorHttpPort}:4318"    # host dynamic → container 4318
      - "${promExporterPort}:8889"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ${prometheusPath}:/etc/prometheus/prometheus.yml
    ports:
      - "${promUiPort}:9090"

  loki:
    image: grafana/loki:2.9.4
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "${lokiPort}:3100"

  tempo:
    image: grafana/tempo:2.4.1
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ${tempoPath}:/etc/tempo.yaml
      - tempo-data:/tmp/tempo       # persistent storage
    ports:
      - "${tempoPort}:3200"

volumes:
  tempo-data:
`;
  await fs.writeFile(dockerComposePath, dockerYaml, 'utf8');
  console.log(
    chalk.green(
      '✅ Wrote docker-compose.yml with dynamic host → fixed container ports'
    )
  );

  console.log(chalk.blue(`ℹ️ A2A initialized at ${configDir}`));
}
