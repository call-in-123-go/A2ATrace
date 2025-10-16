import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";
import chalk from "chalk";

export default async function init() {
  const homeDir = process.env.HOME || process.env.USERPROFILE!;
  const configDir = path.join(homeDir, ".a2a");
  const configPath = path.join(configDir, "config.json");

  await fs.ensureDir(configDir);

  const token = randomUUID();
  const config = {
    collector: { endpoint: "http://localhost:4318/v1/traces", token },
    dashboard: { port: 4000 }
  };

  await fs.writeJson(configPath, config, { spaces: 2 });

  console.log(chalk.green("✅ A2A initialized successfully!"));
  console.log(chalk.gray(`Config written to: ${configPath}`));
}
