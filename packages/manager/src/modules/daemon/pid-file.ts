import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const PID_FILE = join(homedir(), '.local-llm-manager', 'manager.pid');

export function getPidFilePath(): string {
  return PID_FILE;
}

export async function writePid(pid: number): Promise<void> {
  await mkdir(dirname(PID_FILE), { recursive: true });
  await writeFile(PID_FILE, String(pid), 'utf-8');
}

export async function readPid(): Promise<number | null> {
  try {
    const content = await readFile(PID_FILE, 'utf-8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export async function removePid(): Promise<void> {
  try {
    await unlink(PID_FILE);
  } catch {
    // ignore — file may not exist (already cleaned up or never written)
  }
}

/**
 * Check if a process is alive by sending signal 0 (no-op) to it.
 * Returns true if the process exists, false if the OS reports ESRCH.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface DaemonCheck {
  running: boolean;
  pid?: number;
}

/**
 * Check whether a daemon is already running.
 * Reads the PID file; if found and the process exists, returns `{ running: true, pid }`.
 * If the file refers to a dead process, cleans up the stale file and returns `{ running: false }`.
 */
export async function checkExistingDaemon(): Promise<DaemonCheck> {
  const pid = await readPid();
  if (pid === null) {
    return { running: false };
  }
  if (isProcessAlive(pid)) {
    return { running: true, pid };
  }
  // Stale PID file — clean it up so the next start can proceed
  await removePid();
  return { running: false };
}
