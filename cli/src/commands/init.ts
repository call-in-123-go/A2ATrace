import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";
import chalk from "chalk";

export default async function init() {
  const homeDir = process.env.HOME || process.env.USERPROFILE!;
  const configDir = path.join(homeDir, ".a2a");
  const configPath = path.join(configDir, "config.json");
  const collectorPath = path.join(configDir, "collector-config.yaml");
  const prometheusPath = path.join(configDir, "prometheus.yml");
  const dockerComposePath = path.join(configDir, "docker-compose.yml");

  await fs.ensureDir(configDir);

  // Global config.json
  if (!(await fs.pathExists(configPath))) {
    const token = randomUUID();
    const config = {
      collector: { endpoint: "http://localhost:4318/v1/traces", token },
      dashboard: { port: 4000 }
    };
    await fs.writeJson(configPath, config, { spaces: 2 });
    console.log(chalk.green("✅ Wrote global config.json"));
  }

  // Collector config
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
    endpoint: "0.0.0.0:9464"
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"
  tempo:
    endpoint: "http://tempo:4317" # gRPC

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
    console.log(chalk.green("✅ Wrote collector-config.yaml"));
  }

  // Prometheus config
  if (!(await fs.pathExists(prometheusPath))) {
    const prometheusYaml = `
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "a2a-agents"
    static_configs:
      - targets: ["otel-collector:9464"]
`;
    await fs.writeFile(prometheusPath, prometheusYaml, "utf8");
    console.log(chalk.green("✅ Wrote prometheus.yml"));
  }

  // Docker Compose
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
      - "4317:4317"
      - "4318:4318"
      - "8889:8889"
      - "9464:9464"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ${prometheusPath}:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  loki:
    image: grafana/loki:2.9.4
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "3100:3100"

  tempo:
    image: grafana/tempo:2.4.1
    command: ["-config.file=/etc/tempo.yaml"]
    ports:
      - "3200:3200"
      - "4317:4317" # gRPC ingest

  dashboard:
    build: ./client
    ports:
      - "4000:4000"
`;
    await fs.writeFile(dockerComposePath, dockerYaml, "utf8");
    console.log(chalk.green("✅ Wrote docker-compose.yml"));
  }

  console.log(chalk.blue(`ℹ️ A2A initialized at ${configDir}`));
}
