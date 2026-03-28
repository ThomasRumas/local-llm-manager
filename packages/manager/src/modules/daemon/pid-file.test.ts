import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock node:fs/promises ────────────────────────────────────────────────────
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import {
  readPid,
  writePid,
  removePid,
  isProcessAlive,
  checkExistingDaemon,
  getPidFilePath,
} from './pid-file.js';

// ─── readPid ──────────────────────────────────────────────────────────────────

describe('readPid', () => {
  it('returns null when the PID file does not exist', async () => {
    vi.mocked(readFile).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    expect(await readPid()).toBeNull();
  });

  it('returns the integer PID when the file exists', async () => {
    vi.mocked(readFile).mockResolvedValue('42789');
    expect(await readPid()).toBe(42789);
  });

  it('strips surrounding whitespace from the file content', async () => {
    vi.mocked(readFile).mockResolvedValue('  12345\n');
    expect(await readPid()).toBe(12345);
  });

  it('returns null when the file contains non-numeric content', async () => {
    vi.mocked(readFile).mockResolvedValue('corrupted');
    expect(await readPid()).toBeNull();
  });
});

// ─── writePid ─────────────────────────────────────────────────────────────────

describe('writePid', () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it('creates the parent directory with { recursive: true }', async () => {
    await writePid(99999);
    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('writes the PID as a plain string to the PID file', async () => {
    await writePid(12345);
    expect(writeFile).toHaveBeenCalledWith(getPidFilePath(), '12345', 'utf-8');
  });
});

// ─── removePid ────────────────────────────────────────────────────────────────

describe('removePid', () => {
  it('deletes the PID file', async () => {
    vi.mocked(unlink).mockResolvedValue(undefined);
    await removePid();
    expect(unlink).toHaveBeenCalledWith(getPidFilePath());
  });

  it('does not throw when the file does not exist', async () => {
    vi.mocked(unlink).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    await expect(removePid()).resolves.toBeUndefined();
  });
});

// ─── isProcessAlive ───────────────────────────────────────────────────────────

describe('isProcessAlive', () => {
  it('returns true when process.kill(pid, 0) succeeds', () => {
    vi.spyOn(process, 'kill').mockReturnValue(true);
    expect(isProcessAlive(12345)).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(12345, 0);
  });

  it('returns false when process.kill throws (ESRCH — no such process)', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    });
    expect(isProcessAlive(99999)).toBe(false);
  });

  it('returns false when process.kill throws EPERM', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
    });
    expect(isProcessAlive(1)).toBe(false);
  });
});

// ─── checkExistingDaemon ──────────────────────────────────────────────────────

describe('checkExistingDaemon', () => {
  it('returns { running: false } when there is no PID file', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
    const result = await checkExistingDaemon();
    expect(result).toEqual({ running: false });
  });

  it('returns { running: true, pid } when the process is alive', async () => {
    vi.mocked(readFile).mockResolvedValue('12345');
    vi.spyOn(process, 'kill').mockReturnValue(true);
    const result = await checkExistingDaemon();
    expect(result).toEqual({ running: true, pid: 12345 });
  });

  it('removes the stale PID file and returns { running: false }', async () => {
    vi.mocked(readFile).mockResolvedValue('99999');
    vi.mocked(unlink).mockResolvedValue(undefined);
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    });
    const result = await checkExistingDaemon();
    expect(result).toEqual({ running: false });
    expect(unlink).toHaveBeenCalled();
  });
});
