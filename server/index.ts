import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PomodoroStorage } from "./storage.js";
import { registerPomodoroTools } from "./tools.js";
import { startTimerWatcher } from "./notifier.js";

function parseDataDir(): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--data-dir=") || arg.startsWith("--data_dir=")) {
      return arg.split("=")[1];
    }
    if ((arg === "--data-dir" || arg === "--data_dir") && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return path.join(os.homedir(), ".gemini", "pomodoro-data");
}

async function main() {
  const dataDir = parseDataDir();
  const storage = new PomodoroStorage(dataDir);
  startTimerWatcher(storage);
  const server = new McpServer(
    { name: "pomodoro", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  registerPomodoroTools(server, storage);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Pomodoro server fatal error:", err);
  process.exit(1);
});
