import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Top-level mock declarations (hoisted) ────────────────────────────────────
vi.mock('./config.js');
vi.mock('./client.js');

import { loadConfig, setConfigValue } from './config.js';
import { listModels, startModel, getStatus, stopModel } from './client.js';

const mockLoadConfig = vi.mocked(loadConfig);
const mockSetConfigValue = vi.mocked(setConfigValue);
const mockListModels = vi.mocked(listModels);
const mockStartModel = vi.mocked(startModel);
const mockGetStatus = vi.mocked(getStatus);
const mockStopModel = vi.mocked(stopModel);

const DEFAULT_CONFIG = {
  remoteUrl: 'http://localhost:3333',
  defaultModel: undefined,
  defaultConfig: undefined,
};

// ── Helper to run index.ts main() once with given argv ────────────────────────
// Run index.ts main() with the given argv and capture output + exit code.
async function runCli(args: string[]) {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...a: unknown[]) => logs.push(a.map(String).join(' '));
  console.error = (...a: unknown[]) => errors.push(a.map(String).join(' '));

  const origArgv = process.argv;
  process.argv = ['node', 'llm-client', ...args];

  let exitCode: number | undefined;
  const origExit = process.exit;
  // Non-throwing mock: record the code so callers can assert on it.
  // We intentionally do not throw here — throwing inside .catch() creates an
  // unhandled rejection that Vitest surfaces as a test failure.
  process.exit = ((code?: number | string | null) => {
    exitCode = typeof code === 'number' ? code : Number(code ?? 0);
  }) as typeof process.exit;

  try {
    vi.resetModules();
    await import('./index.js');
    // Give async main() (and its .catch handler) time to complete
    await new Promise<void>((r) => setTimeout(r, 100));
  } finally {
    console.log = origLog;
    console.error = origError;
    process.argv = origArgv;
    process.exit = origExit;
  }

  return { logs, errors, exitCode };
}

describe('CLI index.ts', () => {
  beforeEach(() => {
    mockLoadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
    mockSetConfigValue.mockResolvedValue(undefined);
    vi.mocked(loadConfig as any)['saveConfig'] = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  // ── help ──────────────────────────────────────────────────────────────────
  describe('help command', () => {
    it('prints usage on help', async () => {
      const { logs } = await runCli(['help']);
      expect(logs.join('\n')).toContain('llm-client');
    });

    it('prints usage on --help', async () => {
      const { logs } = await runCli(['--help']);
      expect(logs.join('\n')).toContain('Commands');
    });

    it('prints usage on no args', async () => {
      const { logs } = await runCli([]);
      expect(logs.join('\n')).toContain('Commands');
    });
  });

  // ── config show ───────────────────────────────────────────────────────────
  describe('config show', () => {
    it('displays current configuration', async () => {
      mockLoadConfig.mockResolvedValue({
        remoteUrl: 'http://my-server:4444',
        defaultModel: 'Qwen',
      } as any);
      const { logs } = await runCli(['config', 'show']);
      expect(logs.join('\n')).toContain('http://my-server:4444');
      expect(logs.join('\n')).toContain('Qwen');
    });
  });

  // ── config set ────────────────────────────────────────────────────────────
  describe('config set', () => {
    it('sets a valid config key', async () => {
      const { errors } = await runCli([
        'config',
        'set',
        'remote-url',
        'http://10.0.0.1:3333',
      ]);
      expect(errors.join('\n')).not.toContain('Unknown config key');
      expect(mockSetConfigValue).toHaveBeenCalledWith(
        'remoteUrl',
        'http://10.0.0.1:3333',
      );
    });

    it('exits 1 on unknown key', async () => {
      const { exitCode } = await runCli(['config', 'set', 'bad-key', 'val']);
      expect(exitCode).toBe(1);
    });

    it('exits 1 when key or value is missing', async () => {
      const { exitCode } = await runCli(['config', 'set']);
      expect(exitCode).toBe(1);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────
  describe('list command', () => {
    it('displays configured models', async () => {
      mockListModels.mockResolvedValue({
        models: [
          {
            filename: 'mymodel.gguf',
            configs: [{ name: 'default', alias: 'MyAlias' }],
          },
        ],
      } as any);
      const { logs } = await runCli(['list']);
      expect(logs.join('\n')).toContain('MyAlias');
    });

    it('displays message when no models found', async () => {
      mockListModels.mockResolvedValue({ models: [] } as any);
      const { logs } = await runCli(['list']);
      expect(logs.join('\n')).toContain('No configured models');
    });

    it('exits 1 on network error', async () => {
      mockListModels.mockRejectedValue(new Error('Cannot reach server'));
      const { exitCode } = await runCli(['list']);
      expect(exitCode).toBe(1);
    });
  });

  // ── start ─────────────────────────────────────────────────────────────────
  describe('start command', () => {
    it('starts model by name', async () => {
      mockStartModel.mockResolvedValue({
        success: true,
        port: 8001,
        pid: 1234,
      } as any);
      const { logs } = await runCli(['start', 'mymodel']);
      expect(logs.join('\n')).toContain('started');
    });

    it('exits 1 when no model specified and no default', async () => {
      mockLoadConfig.mockResolvedValue({
        remoteUrl: 'http://localhost:3333',
      } as any);
      const { exitCode } = await runCli(['start']);
      expect(exitCode).toBe(1);
    });

    it('passes --config flag to startModel', async () => {
      mockStartModel.mockResolvedValue({
        success: true,
        port: 8001,
        pid: 1,
      } as any);
      await runCli(['start', 'mymodel', '--config', 'quality']);
      expect(mockStartModel).toHaveBeenCalledWith(
        expect.any(String),
        'mymodel',
        'quality',
      );
    });

    it('exits 1 on network error', async () => {
      mockStartModel.mockRejectedValue(new Error('Cannot reach server'));
      const { exitCode } = await runCli(['start', 'mymodel']);
      expect(exitCode).toBe(1);
    });
  });

  // ── status ────────────────────────────────────────────────────────────────
  describe('status command', () => {
    it('shows running status with model info', async () => {
      mockGetStatus.mockResolvedValue({
        running: true,
        modelFile: 'test.gguf',
        configName: 'default',
        port: 8001,
        pid: 999,
        uptimeSeconds: 65,
        error: null,
      } as any);
      const { logs } = await runCli(['status']);
      expect(logs.join('\n')).toContain('Running');
    });

    it('shows stopped status', async () => {
      mockGetStatus.mockResolvedValue({
        running: false,
        modelFile: null,
        configName: null,
        port: null,
        pid: null,
        uptimeSeconds: 0,
        error: null,
      } as any);
      const { logs } = await runCli(['status']);
      expect(logs.join('\n')).toContain('Not running');
    });

    it('shows uptime in minutes for running server', async () => {
      mockGetStatus.mockResolvedValue({
        running: true,
        modelFile: 'test.gguf',
        configName: 'default',
        port: 8001,
        pid: 999,
        uptimeSeconds: 90,
        error: null,
      } as any);
      const { logs } = await runCli(['status']);
      expect(logs.join('\n')).toContain('1m');
    });

    it('shows uptime in hours for long-running server', async () => {
      mockGetStatus.mockResolvedValue({
        running: true,
        modelFile: 'test.gguf',
        configName: 'default',
        port: 8001,
        pid: 999,
        uptimeSeconds: 3700,
        error: null,
      } as any);
      const { logs } = await runCli(['status']);
      expect(logs.join('\n')).toContain('1h');
    });

    it('shows error field when status has error', async () => {
      mockGetStatus.mockResolvedValue({
        running: true,
        modelFile: 'test.gguf',
        configName: 'default',
        port: 8001,
        pid: 999,
        uptimeSeconds: 30,
        error: 'Out of memory',
      } as any);
      const { logs } = await runCli(['status']);
      expect(logs.join('\n')).toContain('Out of memory');
    });

    it('exits 1 on network error', async () => {
      mockGetStatus.mockRejectedValue(new Error('Network error'));
      const { exitCode } = await runCli(['status']);
      expect(exitCode).toBe(1);
    });
  });

  // ── stop ──────────────────────────────────────────────────────────────────
  describe('stop command', () => {
    it('stops the running server', async () => {
      mockStopModel.mockResolvedValue({ success: true } as any);
      const { logs } = await runCli(['stop']);
      expect(logs.join('\n')).toContain('stopped');
    });

    it('exits 1 when stop returns success=false', async () => {
      mockStopModel.mockResolvedValue({ success: false } as any);
      const { exitCode } = await runCli(['stop']);
      expect(exitCode).toBe(1);
    });

    it('exits 1 on network error', async () => {
      mockStopModel.mockRejectedValue(new Error('Network error'));
      const { exitCode } = await runCli(['stop']);
      expect(exitCode).toBe(1);
    });
  });

  // ── config sub-commands ───────────────────────────────────────────────────
  describe('config unknown sub-command', () => {
    it('exits 1 on unknown config sub-command', async () => {
      const { exitCode, errors } = await runCli(['config', 'unknown-sub']);
      expect(exitCode).toBe(1);
      expect(errors.join('\n')).toContain('Unknown config sub-command');
    });
  });

  // ── unknown command ───────────────────────────────────────────────────────
  describe('unknown command', () => {
    it('exits 1 on unknown command', async () => {
      const { exitCode } = await runCli(['bogus']);
      expect(exitCode).toBe(1);
    });
  });
});
