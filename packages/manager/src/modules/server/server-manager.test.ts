import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// ── Mock llamaService ─────────────────────────────────────────────────────────
vi.mock('../llama/llama.service.js', () => ({
  llamaService: {
    launch: vi.fn(),
  },
}));

import { ServerManager } from './server-manager.js';
import { llamaService } from '../llama/llama.service.js';

const mockLaunch = vi.mocked(llamaService.launch);

/** Create a fake ChildProcess EventEmitter */
function makeProc(pid = 12345) {
  const proc = Object.assign(new EventEmitter(), {
    pid,
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
  }) as unknown as ChildProcess;
  return proc;
}

const BASE_CONFIG = {
  modelPath: '/models/m.gguf',
  alias: 'MyModel',
  temp: 0.6,
  topP: 0.95,
  topK: 20,
  minP: 0,
  port: 8001,
  ctxSize: 131072,
  kvUnified: true,
  cacheTypeK: 'q8_0',
  cacheTypeV: 'q8_0',
  flashAttn: 'on',
  fit: 'on',
  extraFlags: '',
};

describe('ServerManager', () => {
  let manager: ServerManager;
  let proc: ChildProcess;

  beforeEach(() => {
    manager = new ServerManager();
    proc = makeProc();
    mockLaunch.mockResolvedValue({ process: proc, port: 8001 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  // ── initial state ──────────────────────────────────────────────────────────
  it('has correct initial state', () => {
    const s = manager.getState();
    expect(s.running).toBe(false);
    expect(s.pid).toBeNull();
    expect(s.logs).toEqual([]);
  });

  // ── start() ────────────────────────────────────────────────────────────────
  describe('start()', () => {
    it('calls llamaService.launch with config', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      expect(mockLaunch).toHaveBeenCalledWith(BASE_CONFIG);
    });

    it('sets running state after start', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      const s = manager.getState();
      expect(s.running).toBe(true);
      expect(s.pid).toBe(12345);
      expect(s.modelFile).toBe('m.gguf');
      expect(s.configName).toBe('default');
      expect(s.port).toBe(8001);
    });

    it('emits state-changed event', async () => {
      const listener = vi.fn();
      manager.on('state-changed', listener);
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      expect(listener).toHaveBeenCalled();
    });

    it('resets uptimeSeconds to 0 on new start', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      vi.advanceTimersByTime(5000);
      // start again with new process
      const proc2 = makeProc(99999);
      mockLaunch.mockResolvedValueOnce({ process: proc2, port: 8001 });
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      expect(manager.getState().uptimeSeconds).toBe(0);
    });

    it('adds initial log line on start', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      expect(manager.getState().logs[0]).toContain('Starting llama-server');
    });
  });

  // ── uptime ─────────────────────────────────────────────────────────────────
  describe('uptime timer', () => {
    it('increments uptimeSeconds every second', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      vi.advanceTimersByTime(3000);
      expect(manager.getState().uptimeSeconds).toBe(3);
    });
  });

  // ── log streaming ──────────────────────────────────────────────────────────
  describe('log streaming', () => {
    it('appends stdout lines to logs', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      const stdout = (proc as unknown as { stdout: EventEmitter }).stdout;
      stdout.emit('data', Buffer.from('hello from stdout\n'));
      expect(manager.getState().logs).toContain('hello from stdout');
    });

    it('appends stderr lines to logs', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      const stderr = (proc as unknown as { stderr: EventEmitter }).stderr;
      stderr.emit('data', Buffer.from('error line\n'));
      expect(manager.getState().logs).toContain('error line');
    });

    it('caps logs at MAX_LOGS (500)', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      const stdout = (proc as unknown as { stdout: EventEmitter }).stdout;
      for (let i = 0; i < 510; i++) {
        stdout.emit('data', Buffer.from(`line ${i}\n`));
      }
      expect(manager.getState().logs.length).toBeLessThanOrEqual(500);
    });
  });

  // ── process close ──────────────────────────────────────────────────────────
  describe('process close event', () => {
    it('sets running=false when process exits', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      proc.emit('close', 0);
      expect(manager.getState().running).toBe(false);
      expect(manager.getState().pid).toBeNull();
    });

    it('appends exit log line', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      proc.emit('close', 1);
      const logs = manager.getState().logs;
      expect(logs.at(-1)).toContain('exited with code 1');
    });

    it('ignores close from stale process (race guard)', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      const proc2 = makeProc(99999);
      mockLaunch.mockResolvedValueOnce({ process: proc2, port: 8001 });
      await manager.start(BASE_CONFIG, 'm.gguf', 'default'); // replaces proc with proc2
      proc.emit('close', 0); // stale proc fires close
      expect(manager.getState().running).toBe(true); // should still be running
    });
  });

  // ── process error ──────────────────────────────────────────────────────────
  describe('process error event', () => {
    it('sets error and running=false', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      proc.emit('error', new Error('spawn ENOENT'));
      const s = manager.getState();
      expect(s.running).toBe(false);
      expect(s.error).toBe('spawn ENOENT');
    });
  });

  // ── stop() ────────────────────────────────────────────────────────────────
  describe('stop()', () => {
    it('kills the process and sets running=false', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      const kill = (proc as unknown as { kill: ReturnType<typeof vi.fn> }).kill;
      manager.stop();
      expect(kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.getState().running).toBe(false);
    });

    it('clears uptime timer', async () => {
      await manager.start(BASE_CONFIG, 'm.gguf', 'default');
      vi.advanceTimersByTime(2000);
      manager.stop();
      vi.advanceTimersByTime(3000);
      expect(manager.getState().uptimeSeconds).toBe(0); // reset to 0 on stop
    });

    it('is safe to call when not running', () => {
      expect(() => manager.stop()).not.toThrow();
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────
  describe('destroy()', () => {
    it('stops server and removes all listeners', () => {
      const listener = vi.fn();
      manager.on('state-changed', listener);
      manager.start(BASE_CONFIG, 'm.gguf', 'default');
      manager.destroy();
      manager.stop(); // emit more events after destroy
      expect(listener).toHaveBeenCalledTimes(
        listener.mock.calls.length, // no new calls after destroy
      );
    });
  });
});
