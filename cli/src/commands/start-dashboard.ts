import { execa } from 'execa';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs-extra';

export default async function startDashboard() {
  const cwd = process.cwd();
  const collectorConfig = path.resolve(cwd, '../collector/config.yaml');
  const dashboardDir = path.resolve(cwd, '../client');

  if (!(await fs.pathExists(collectorConfig))) {
    console.error(
      chalk.red('❌ Missing collector config at:'),
      collectorConfig
    );
    process.exit(1);
  }

  console.log(chalk.blue('🚀 Starting telemetry stack...'));

  execa('otelcol', ['--config', collectorConfig], { stdio: 'inherit' });
  execa('prometheus', ['--config.file=../collector/prometheus.yml'], {
    stdio: 'inherit',
  });
  execa('loki', ['--config.file=../collector/loki-config.yml'], {
    stdio: 'inherit',
  });
  execa('tempo', ['--config.file=../collector/tempo-config.yml'], {
    stdio: 'inherit',
  });

  if (await fs.pathExists(dashboardDir)) {
    execa('npm', ['run', 'dev'], { cwd: dashboardDir, stdio: 'inherit' });
  } else {
    console.warn(chalk.yellow('⚠️ Dashboard not found at:'), dashboardDir);
  }
}
