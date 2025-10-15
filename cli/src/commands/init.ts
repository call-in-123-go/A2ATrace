import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";
import chalk from "chalk";

export default async function init() {
  try {
    // Find the user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE!;
    const configDir = path.join(homeDir, ".a2a");
    const configPath = path.join(configDir, "config.json");

    // Ensure ~/.a2a directory exists
    await fs.ensureDir(configDir);

    // Create a new token
    const token = randomUUID();

    // Config content
    const config = {
      collector: {
        endpoint: "http://localhost:4318/v1/traces", // default OTLP endpoint
        token
      },
      dashboard: {
        port: 4000
      }
    };

    // Write config.json
    await fs.writeJson(configPath, config, { spaces: 2 });

    console.log(chalk.green("✅ A2A initialized successfully!"));
    console.log(chalk.gray(`Config written to: ${configPath}`));
    console.log(chalk.gray(`Token: ${token}`));
  } catch (err) {
    console.error(chalk.red("❌ Failed to initialize A2A:"), err);
  }
}
