import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export default async function injectOtel() {
  try {
    const cwd = process.cwd();
    const agentConfigPath = path.join(cwd, '.a2a.config.json');

    if (!(await fs.pathExists(agentConfigPath))) {
      console.error(
        chalk.red('❌ No .a2a.config.json found. Run `a2a link` first.`')
      );
      process.exit(1);
    }

    const agentConfig = await fs.readJson(agentConfigPath);
    const readmePath = path.join(cwd, 'a2a.README.md');

    const readmeContent = `# A2A Telemetry Setup for ${agentConfig.agentName}

This agent is configured with \`.a2a.config.json\`.

---

## JavaScript (Node.js)

Install the CLI:
\`\`\`bash
npm install a2a-cli
\`\`\`

Use in your app:
\`\`\`js
import { startTelemetry } from "a2a-cli/telemetry";
await startTelemetry("./.a2a.config.json");
\`\`\`

---

## Python

Install OTel:
\`\`\`bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation
\`\`\`

Use in your app:
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
`;

    await fs.writeFile(readmePath, readmeContent, 'utf8');

    console.log(chalk.green('✅ OTel setup injected successfully!'));
    console.log(chalk.gray(`File created: ${readmePath}`));
    console.log(
      chalk.cyan('👉 Add this line at the very top of your entrypoint:')
    );
    console.log(chalk.yellow(`import './a2a-otel-setup.js';`));
  } catch (err) {
    console.error(chalk.red('❌ Failed to inject OTel setup:'), err);
  }
}
