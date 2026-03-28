import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// ── Mock child_process ────────────────────────────────────────────────────────
const mockExecFile = vi.fn();
const mockSpawn = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('node:util', () => ({
  promisify: (fn: unknown) => fn,
}));

// ── Mock node:fs/promises ─────────────────────────────────────────────────────
const mockAccess = vi.fn();
vi.mock('node:fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
}));

import { LlamaService } from './llama.service.js';

function makeProc(pid = 1234) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = Object.assign(new EventEmitter(), {
    pid,
    stdout,
    stderr,
    kill: vi.fn(),
  }) as unknown as ChildProcess;
  return proc;
}

describe('LlamaService', () => {
  let svc: LlamaService;

  beforeEach(() => {
    svc = new LlamaService();
  });

  // ── detect() ───────────────────────────────────────────────────────────────
  describe('detect()', () => {
    it('returns installed=true when llama-server is on PATH', async () => {
      mockExecFile
        .mockResolvedValueOnce({
          stdout: '/usr/local/bin/llama-server\n',
          stderr: '',
        })
        .mockResolvedValueOnce({
          stdout: 'llama-server version 1.2.3\n',
          stderr: '',
        });

      const result = await svc.detect();
      expect(result.installed).toBe(true);
      expect(result.path).toBe('/usr/local/bin/llama-server');
      expect(result.version).toBe('llama-server version 1.2.3');
    });

    it('returns installed=false when which fails', async () => {
      mockExecFile.mockRejectedValueOnce(new Error('not found'));
      const result = await svc.detect();
      expect(result.installed).toBe(false);
    });

    it('returns installed=false when which returns empty string', async () => {
      mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' });
      const result = await svc.detect();
      expect(result.installed).toBe(false);
    });

    it('returns version=undefined when --version fails', async () => {
      mockExecFile
        .mockResolvedValueOnce({
          stdout: '/usr/bin/llama-server\n',
          stderr: '',
        })
        .mockRejectedValueOnce(new Error('version error'));

      const result = await svc.detect();
      expect(result.installed).toBe(true);
      expect(result.version).toBeUndefined();
    });
  });

  // ── install() ──────────────────────────────────────────────────────────────
  describe('install()', () => {
    it('resolves success=true when brew exits with code 0', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);

      const promise = svc.install(() => {});
      proc.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('resolves success=false when brew exits with non-zero code', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);

      const promise = svc.install(() => {});
      proc.emit('close', 1);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('code 1');
    });

    it('streams stdout data via onData callback', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      const received: string[] = [];

      const promise = svc.install((d) => received.push(d));
      (proc as unknown as { stdout: EventEmitter }).stdout.emit(
        'data',
        Buffer.from('installing...\n'),
      );
      proc.emit('close', 0);

      await promise;
      expect(received).toContain('installing...\n');
    });

    it('resolves with error on process error event', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);

      const promise = svc.install(() => {});
      proc.emit('error', new Error('ENOENT brew'));

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('ENOENT brew');
    });
  });

  // ── launch() ──────────────────────────────────────────────────────────────
  describe('launch()', () => {
    const baseOptions = {
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

    beforeEach(() => {
      // Default: which resolves the binary path
      mockExecFile.mockResolvedValue({
        stdout: '/opt/homebrew/bin/llama-server\n',
        stderr: '',
      });
    });

    it('returns the spawned process and port', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      const result = await svc.launch(baseOptions);
      expect(result.process).toBe(proc);
      expect(result.port).toBe(8001);
    });

    it('spawns with the resolved full binary path', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch(baseOptions);
      expect(mockSpawn).toHaveBeenCalledWith(
        '/opt/homebrew/bin/llama-server',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('falls back to /opt/homebrew/bin when which fails', async () => {
      mockExecFile.mockRejectedValueOnce(new Error('not found'));
      mockAccess.mockResolvedValueOnce(undefined); // /opt/homebrew/bin exists
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch(baseOptions);
      expect(mockSpawn).toHaveBeenCalledWith(
        '/opt/homebrew/bin/llama-server',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('falls back to /usr/local/bin when opt/homebrew is absent', async () => {
      mockExecFile.mockRejectedValueOnce(new Error('not found'));
      mockAccess
        .mockRejectedValueOnce(new Error('ENOENT')) // /opt/homebrew/bin absent
        .mockResolvedValueOnce(undefined); // /usr/local/bin exists
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch(baseOptions);
      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/local/bin/llama-server',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('falls back to bare "llama-server" when all candidates miss', async () => {
      mockExecFile.mockRejectedValueOnce(new Error('not found'));
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch(baseOptions);
      expect(mockSpawn).toHaveBeenCalledWith(
        'llama-server',
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('includes --kv-unified flag when kvUnified=true', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch(baseOptions);
      const args: string[] = mockSpawn.mock.calls[0][1];
      expect(args).toContain('--kv-unified');
    });

    it('omits --kv-unified flag when kvUnified=false', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch({ ...baseOptions, kvUnified: false });
      const args: string[] = mockSpawn.mock.calls[0][1];
      expect(args).not.toContain('--kv-unified');
    });

    it('omits --flash-attn when flashAttn=off', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch({ ...baseOptions, flashAttn: 'off' });
      const args: string[] = mockSpawn.mock.calls[0][1];
      expect(args).not.toContain('--flash-attn');
    });

    it('includes --flash-attn on when flashAttn=on', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch({ ...baseOptions, flashAttn: 'on' });
      const args: string[] = mockSpawn.mock.calls[0][1];
      expect(args).toContain('--flash-attn');
    });

    it('omits --fit when fit=off', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch({ ...baseOptions, fit: 'off' });
      const args: string[] = mockSpawn.mock.calls[0][1];
      expect(args).not.toContain('--fit');
    });

    it('splits extraFlags by whitespace', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch({ ...baseOptions, extraFlags: '--no-mmap --threads 4' });
      const args: string[] = mockSpawn.mock.calls[0][1];
      expect(args).toContain('--no-mmap');
      expect(args).toContain('--threads');
      expect(args).toContain('4');
    });

    it('uses alias for --alias flag', async () => {
      const proc = makeProc();
      mockSpawn.mockReturnValueOnce(proc);
      await svc.launch({ ...baseOptions, alias: 'CoolModel' });
      const args: string[] = mockSpawn.mock.calls[0][1];
      const aliasIdx = args.indexOf('--alias');
      expect(args[aliasIdx + 1]).toBe('CoolModel');
    });
  });
});
