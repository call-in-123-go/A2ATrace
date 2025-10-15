import { execa } from "execa";
import path from "path";
import chalk from "chalk";
import fs from "fs-extra";

export default async function startDashboard() {
  try {
    const cwd = process.cwd();

    // Paths to collector config and dashboard
    const collectorConfig = path.resolve(cwd, "collector/config.yaml");
    const dashboardDir = path.resolve(cwd, "../client");

    // Check collector config
    if (!(await fs.pathExists(collectorConfig))) {
      console.error(chalk.red("❌ No collector config found at:"), collectorConfig);
      console.error(chalk.gray("👉 Make sure you have collector/config.yaml in place."));
      process.exit(1);
    }

    console.log(chalk.blue("🚀 Starting A2A Telemetry Stack..."));

    // Start the OpenTelemetry Collector
    execa("otelcol", ["--config", collectorConfig], {
      stdio: "inherit"
    });

    // Start Prometheus
    execa("prometheus", ["--config.file=collector/prometheus.yml"], {
      stdio: "inherit"
    });

    // Start Loki
    execa("loki", ["--config.file=collector/loki-config.yml"], {
      stdio: "inherit"
    });

    // Start Tempo
    execa("tempo", ["--config.file=collector/tempo-config.yml"], {
      stdio: "inherit"
    });

    // Start the frontend dashboard
    if (await fs.pathExists(dashboardDir)) {
      execa("npm", ["run", "dev"], {
        cwd: dashboardDir,
        stdio: "inherit"
      });
    } else {
      console.warn(
        chalk.yellow("⚠️ Dashboard folder not found. Expected at:"),
        dashboardDir
      );
    }

    console.log(chalk.green("✅ Telemetry stack started."));
    console.log(chalk.gray("👉 Dashboard should be live at http://localhost:4000"));
  } catch (err) {
    console.error(chalk.red("❌ Failed to start dashboard:"), err);
  }
}
