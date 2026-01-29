import fs from 'fs-extra';
import { PATHS } from '../config/paths.js';

export async function writePid(pid: number): Promise<void> {
  await fs.ensureDir(PATHS.root);
  await fs.writeFile(PATHS.pid, pid.toString(), 'utf8');
}

export async function readPid(): Promise<number | null> {
  try {
    if (await fs.pathExists(PATHS.pid)) {
      const pidStr = await fs.readFile(PATHS.pid, 'utf8');
      const pid = parseInt(pidStr.trim(), 10);
      return isNaN(pid) ? null : pid;
    }
  } catch (error) {
    // ignore error, treat as no PID
  }
  return null;
}

export async function clearPid(): Promise<void> {
  if (await fs.pathExists(PATHS.pid)) {
    await fs.remove(PATHS.pid);
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    // signal 0 checks if process exists without killing it
    return process.kill(pid, 0);
  } catch (e: any) {
    return e.code === 'EPERM'; // If EPERM, it exists but we lack permission (still running)
  }
}

export async function checkStalePid(): Promise<void> {
    const pid = await readPid();
    if (pid !== null) {
        if (!isProcessRunning(pid)) {
            await clearPid();
        }
    }
}
