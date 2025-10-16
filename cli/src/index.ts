#!/usr/bin/env node
import { Command } from "commander";
import init from "./commands/init.js";
import link from "./commands/link-agent.js";
import injectOtel from "./commands/inject-otel.js";
import startDashboard from "./commands/start-dashboard.js";

const program = new Command();

program
  .name("a2a")
  .description("A2A Agent Telemetry CLI")
  .version("0.1.0");

program.command("init")
  .description("Initialize local A2A telemetry environment")
  .action(init);

program.command("link")
  .description("Link current project as an A2A agent")
  .option("-n, --name <agentName>", "Agent name")
  .action(link);

program.command("inject-otel")
  .description("Inject OpenTelemetry setup into the current project")
  .action(injectOtel);

program.command("start-dashboard")
  .description("Start local telemetry stack (collector, Prometheus, Loki, Tempo, dashboard)")
  .action(startDashboard);

program.parse();
