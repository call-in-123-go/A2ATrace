import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import chalk from 'chalk';

export default async function link(opts: { name?: string }) {
  try {
    const cwd = process.cwd();

    const homeDir = process.env.HOME || process.env.USERPROFILE!;
    const globalConfigPath = path.join(homeDir, '.a2a', 'config.json');

    if (!(await fs.pathExists(globalConfigPath))) {
      console.error(
        chalk.red('❌ Global A2A config not found. Run `a2a init` first.')
      );
      process.exit(1);
    }

    const globalConfig = await fs.readJson(globalConfigPath);

    const agentConfigPath = path.join(cwd, '.a2a.config.json');
    const readmePath = path.join(cwd, 'a2a.README.md');

    const config = {
      agentId: randomUUID(),
      agentName: opts.name || path.basename(cwd),
      endpoint: globalConfig.collector.endpoint,
      token: globalConfig.collector.token,
      metricPort: 9464,
    };

    await fs.writeJson(agentConfigPath, config, { spaces: 2 });

    const readmeContent = `# A2A Telemetry Setup for ${config.agentName}

This project has been linked to the local A2A telemetry system.
Configuration file generated: \`.a2a.config.json\`

---

## JavaScript (Node.js)

Install the CLI:
\`\`\`bash
npm install a2a-cli
\`\`\`

Then import telemetry in your entrypoint:
\`\`\`js
import { startTelemetry } from "a2a-cli/telemetry";
await startTelemetry("./.a2a.config.json");
\`\`\`

---

## Python

Install OpenTelemetry packages:
\`\`\`bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation
\`\`\`

Add this to your Python entrypoint:
\`\`\`python
import json
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry import trace

with open(".a2a.config.json") as f:
    config = json.load(f)

resource = Resource.create({
    "service.name": config["agentName"],
    "a2a.agent.id": config["agentId"]
})

trace_exporter = OTLPSpanExporter(
    endpoint=config["endpoint"],
    headers={"Authorization": f"Bearer {config['token']}"}
)

provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(trace_exporter))
trace.set_tracer_provider(provider)

print(f"📡 Telemetry started for {config['agentName']}")
\`\`\`

---

✅ Both examples read from the same \`.a2a.config.json\`.  
`;

    await fs.writeFile(readmePath, readmeContent, 'utf8');

    console.log(chalk.green(`✅ Linked agent "${config.agentName}"`));
    console.log(chalk.gray(`Created .a2a.config.json and a2a.bootstrap.js`));
  } catch (err) {
    console.error(chalk.red('❌ Failed to link agent:'), err);
  }
}
