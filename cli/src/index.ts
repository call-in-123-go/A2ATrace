#!/usr/bin/env node
import { Command } from 'commander';
import init from './commands/init.js';
import startDashboard from './commands/start-dashboard.js';
import link from './commands/link-agent.js';
import injectOtel from './commands/inject-otel.js';

const program = new Command();

program
  .name('a2a')
  .description('A2A Agent Telemetry CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize local A2A telemetry environment')
  .action(init);

program
  .command('start-dashboard')
  .description('Run local dashboard + telemetry collector')
  .action(startDashboard);

program
  .command("link")
  .description("Link current project as an A2A agent")
  .option("-n, --name <agentName>", "Agent name")
  .action(link);

program
  .command('inject-otel')
  .description('Inject OTel setup into the current project')
  .action(injectOtel);

program.parse();
