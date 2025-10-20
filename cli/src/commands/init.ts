import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";
import chalk from "chalk";
import findPort from "find-open-port";

export default async function init() {
  const homeDir = process.env.HOME || process.env.USERPROFILE!;
  const configDir = path.join(homeDir, ".a2a");
  const configPath = path.join(configDir, "config.json");
  const collectorPath = path.join(configDir, "collector-config.yaml");
  const prometheusPath = path.join(configDir, "prometheus.yml");
  const dockerComposePath = path.join(configDir, "docker-compose.yml");

  await fs.ensureDir(configDir);

  // 🔹 Pick dynamic HOST ports
  const collectorHttpPort = await findPort({ start: 4318 });
  const collectorGrpcPort = await findPort({ start: 4317 });
  const promExporterPort = await findPort({ start: 9464 });
  const promUiPort = await findPort({ start: 9090 });
  const lokiPort = await findPort({ start: 3100 });
  const tempoPort = await findPort({ start: 3200 });
  const dashboardPort = await findPort({ start: 4000 });

  // 🔹 Global config.json
  if (!(await fs.pathExists(configPath))) {
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
      chalk.green("✅ Wrote global config.json with dynamic collector endpoints")
    );
  }

  // 🔹 Collector config (fixed container ports!)
  if (!(await fs.pathExists(collectorPath))) {
    const collectorYaml = `
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"
  tempo:
    endpoint: "http://tempo:3200"

processors:
  batch:

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
`;
    await fs.writeFile(collectorPath, collectorYaml, "utf8");
    console.log(chalk.green("✅ Wrote collector-config.yaml with fixed container ports"));
  }

  // 🔹 Prometheus config (fixed container port reference)
  if (!(await fs.pathExists(prometheusPath))) {
    const prometheusYaml = `
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "a2a-agents"
    static_configs:
      - targets: ["otel-collector:8889"]
`;
    await fs.writeFile(prometheusPath, prometheusYaml, "utf8");
    console.log(chalk.green("✅ Wrote prometheus.yml"));
  }

  // 🔹 Docker Compose (host dynamic → container fixed)
  if (!(await fs.pathExists(dockerComposePath))) {
    const dockerYaml = `
version: "3.8"

services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ${collectorPath}:/etc/otel-collector-config.yaml
    ports:
      - "${collectorGrpcPort}:4317"
      - "${collectorHttpPort}:4318"
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
    ports:
      - "${tempoPort}:3200"
`;
    await fs.writeFile(dockerComposePath, dockerYaml, "utf8");
    console.log(
      chalk.green("✅ Wrote docker-compose.yml with dynamic host → fixed container ports")
    );
  }

  console.log(chalk.blue(`ℹ️ A2A initialized at ${configDir}`));
}
