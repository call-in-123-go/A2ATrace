import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";

export default async function startDashboard() {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".a2a");
  const composeFile = path.join(configDir, "docker-compose.yml");

  if (!(await fs.pathExists(composeFile))) {
    console.error(chalk.red("❌ Missing docker-compose.yml. Run `a2a init` first."));
    process.exit(1);
  }

  console.log(chalk.blue("🚀 Starting A2A telemetry stack with Docker..."));
  try {
    await execa("docker", ["compose", "-f", composeFile, "up"], {
      stdio: "inherit",
    });
  } catch (err) {
    console.error(chalk.red("❌ Failed to start dashboard stack:"), err);
  }
}