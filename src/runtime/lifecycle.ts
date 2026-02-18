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

/**
 * Waits until the given PID is no longer running, or until timeout is reached.
 * Returns true if the process died, false if timeout was reached.
 */
export async function waitForProcessDeath(pid: number, timeoutMs = 5000, intervalMs = 200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return !isProcessRunning(pid);
}

export async function checkStalePid(): Promise<void> {
    const pid = await readPid();
    if (pid !== null) {
        // Never treat our own PID as stale — this avoids self-kill loops in containers
        // where a restarted process may inherit the same PID that was previously written.
        if (pid === process.pid) {
            await clearPid();
            return;
        }
        if (!isProcessRunning(pid)) {
            await clearPid();
        }
    }
}

export function killProcess(pid: number): boolean {
  // Safety guard: never kill ourselves
  if (pid === process.pid) return false;

  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch (e: any) {
    if (e.code === 'ESRCH') {
      // Process doesn't exist
      return false;
    }
    throw e;
  }
}
