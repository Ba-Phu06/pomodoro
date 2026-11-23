import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function getPidFilePath(dataDir: string): string {
  return path.join(dataDir, "mini-pill.pid");
}

function getScriptPath(): string {
  const nextTo = path.resolve(__dirname, "mini-pill.ps1");
  if (fs.existsSync(nextTo)) return nextTo;
  const inServer = path.resolve(__dirname, "../server/mini-pill.ps1");
  if (fs.existsSync(inServer)) return inServer;
  return nextTo;
}

function readPid(pidFile: string): number | null {
  if (!fs.existsSync(pidFile)) return null;
  try {
    const raw = fs.readFileSync(pidFile, "utf-8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getMiniPillStatus(dataDir: string): boolean {
  const pidFile = getPidFilePath(dataDir);
  const pid = readPid(pidFile);
  if (!pid) return false;
  if (isProcessAlive(pid)) return true;
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore stale cleanup error
  }
  return false;
}

export function closeMiniPill(dataDir: string): boolean {
  const pidFile = getPidFilePath(dataDir);
  const pid = readPid(pidFile);
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid);
    } catch {
      // ignore kill error
    }
  }
  try {
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  } catch {
    // ignore unlink error
  }
  return false;
}

export function openMiniPill(dataDir: string): boolean {
  if (process.platform !== "win32") return false;
  if (getMiniPillStatus(dataDir)) return true;

  const scriptPath = getScriptPath();
  if (!fs.existsSync(scriptPath)) return false;

  const dataFile = path.join(dataDir, "pomodoro-data.json");
  const pidFile = getPidFilePath(dataDir);

  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-WindowStyle",
      "Hidden",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-DataFile",
      dataFile,
      "-PidFile",
      pidFile,
    ],
    {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
    }
  );
  if (child.pid) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(pidFile, String(child.pid), "utf-8");
  }
  return Boolean(child.pid);
}

export function toggleMiniPill(
  dataDir: string,
  action: "toggle" | "open" | "close" | "status" = "toggle"
): boolean {
  if (action === "status") return getMiniPillStatus(dataDir);
  if (action === "open") return openMiniPill(dataDir);
  if (action === "close") return closeMiniPill(dataDir);
  return getMiniPillStatus(dataDir) ? closeMiniPill(dataDir) : openMiniPill(dataDir);
}
