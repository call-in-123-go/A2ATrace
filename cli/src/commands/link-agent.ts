import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";
import chalk from "chalk";
import prompts from "prompts";

export default async function link(opts: { name?: string }) {
  try {
    const cwd = process.cwd();

    // Global config from init (~/.a2a/config.json)
    const homeDir = process.env.HOME || process.env.USERPROFILE!;
    const globalConfigPath = path.join(homeDir, ".a2a", "config.json");
    const globalAgentsPath = path.join(homeDir, ".a2a", "agents.json");

    if (!(await fs.pathExists(globalConfigPath))) {
      console.error(
        chalk.red("❌ Global A2A config not found. Run `a2a init` first.")
      );
      process.exit(1);
    }

    const globalConfig = await fs.readJson(globalConfigPath);

    // Ask user for metadata
    const responses = await prompts([
      {
        type: "text",
        name: "agentName",
        message: "What is this agent's name?",
        initial: opts.name || path.basename(cwd),
      },
      {
        type: "text",
        name: "role",
        message: "What is this agent's role?",
      },
      {
        type: "list",
        name: "connectedAgents",
        message:
          "List the agents this one connects to (comma separated, e.g. planner,executor)",
        separator: ",",
      },
      {
        type: "list",
        name: "methods",
        message:
          "List the methods or capabilities this agent provides (comma separated)",
        separator: ",",
      },
    ]);

    const config = {
      agentId: randomUUID(),
      agentName: responses.agentName,
      role: responses.role || "Agent",
      connectedAgents: responses.connectedAgents || [],
      methods: responses.methods || [],
      endpoint: globalConfig.collector.endpointHttp,
      grpcEndpoint: globalConfig.collector.endpointGrpc,
      token: globalConfig.collector.token,
      metricPort: globalConfig.ports.prometheusExporter,
    };

    // Write per-project agent config
    const agentConfigPath = path.join(cwd, ".a2a.config.json");
    await fs.writeJson(agentConfigPath, config, { spaces: 2 });

    // Update global agent registry (~/.a2a/agents.json)
    let registry: any[] = [];
    if (await fs.pathExists(globalAgentsPath)) {
      registry = await fs.readJson(globalAgentsPath);
    }
    // Overwrite if agent with same name exists
    const filtered = registry.filter((a) => a.agentName !== config.agentName);
    filtered.push({
      agentId: config.agentId,
      agentName: config.agentName,
      role: config.role,
      connectedAgents: config.connectedAgents,
      methods: config.methods,
    });
    await fs.writeJson(globalAgentsPath, filtered, { spaces: 2 });

    console.log(chalk.green(`✅ Linked agent "${config.agentName}"`));
    console.log(
      chalk.gray(
        `Created .a2a.config.json in ${cwd} and updated ~/.a2a/agents.json`
      )
    );
  } catch (err) {
    console.error(chalk.red("❌ Failed to link agent:"), err);
  }
}
