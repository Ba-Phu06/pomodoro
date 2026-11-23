import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const pluginJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "plugin.json"), "utf-8")
);
const version = pluginJson.version || "1.0.0";

const releaseDir = path.join(rootDir, "release");
const stageDir = path.join(releaseDir, "pomodoro");

fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(path.join(stageDir, "assets"), { recursive: true });
fs.mkdirSync(path.join(stageDir, "dist"), { recursive: true });

const rootFiles = [
  "plugin.json",
  "mcp_config.json",
  "README.md",
  "LICENSE",
  "SECURITY.md",
];
for (const file of rootFiles) {
  fs.copyFileSync(path.join(rootDir, file), path.join(stageDir, file));
}

fs.copyFileSync(
  path.join(rootDir, "assets", "logo.svg"),
  path.join(stageDir, "assets", "logo.svg")
);

const distFiles = [
  "app.html",
  "server.cjs",
  "mini-pill.ps1",
  "notify-popup.ps1",
];
for (const file of distFiles) {
  fs.copyFileSync(
    path.join(rootDir, "dist", file),
    path.join(stageDir, "dist", file)
  );
}

const zipPath = path.join(releaseDir, `pomodoro-plugin-v${version}.zip`);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: "inherit" }
  );
}

process.stdout.write(`Packaged plugin to ${stageDir}\n`);
if (fs.existsSync(zipPath)) {
  process.stdout.write(`Created archive ${zipPath}\n`);
}
