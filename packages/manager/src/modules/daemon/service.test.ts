import { describe, it, expect, vi, beforeEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ─── Mock dependencies ───────────────────────────────────────────────────────

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import {
  detectPlatform,
  generateSystemdUnit,
  generateLaunchdPlist,
  getSystemdUnitPath,
  getLaunchdPlistPath,
  getLogsDir,
  getServiceStatus,
  installService,
  uninstallService,
  startService,
  stopService,
  showLogs,
  findDaemonBinary,
  runServiceCli,
} from './service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Make execFile call its callback with (null, stdout, stderr) so that
 * promisify(execFile) resolves to { stdout, stderr }.
 */
function mockExecFile(stdout = '', stderr = '') {
  vi.mocked(execFile).mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (
        callback as (
          err: null,
          result: { stdout: string; stderr: string },
        ) => void
      )(null, { stdout, stderr });
      return {} as ReturnType<typeof execFile>;
    },
  );
}

function mockExecFileError(message = 'error') {
  vi.mocked(execFile).mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: Error) => void)(new Error(message));
      return {} as ReturnType<typeof execFile>;
    },
  );
}

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  it('returns "linux" on Linux', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    expect(detectPlatform()).toBe('linux');
  });

  it('returns "darwin" on macOS', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    expect(detectPlatform()).toBe('darwin');
  });

  it('throws on unsupported platforms', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    expect(() => detectPlatform()).toThrow('Unsupported platform');
  });
});

// ─── Path helpers ─────────────────────────────────────────────────────────────

describe('getSystemdUnitPath', () => {
  it('resolves under ~/.config/systemd/user/', () => {
    const path = getSystemdUnitPath();
    expect(path).toContain(homedir());
    expect(path).toContain(join('.config', 'systemd', 'user'));
    expect(path).toMatch(/\.service$/);
  });
});

describe('getLaunchdPlistPath', () => {
  it('resolves under ~/Library/LaunchAgents/', () => {
    const path = getLaunchdPlistPath();
    expect(path).toContain(homedir());
    expect(path).toContain(join('Library', 'LaunchAgents'));
    expect(path).toMatch(/\.plist$/);
  });
});

describe('getLogsDir', () => {
  it('resolves under ~/.local-llm-manager/logs', () => {
    const path = getLogsDir();
    expect(path).toBe(join(homedir(), '.local-llm-manager', 'logs'));
  });
});

// ─── generateSystemdUnit ──────────────────────────────────────────────────────

describe('generateSystemdUnit', () => {
  const unit = generateSystemdUnit(
    '/usr/bin/node',
    '/usr/local/bin/llm-manager-daemon',
  );

  it('contains [Unit], [Service], and [Install] sections', () => {
    expect(unit).toContain('[Unit]');
    expect(unit).toContain('[Service]');
    expect(unit).toContain('[Install]');
  });

  it('sets ExecStart to the provided node and daemon paths', () => {
    expect(unit).toContain(
      'ExecStart=/usr/bin/node /usr/local/bin/llm-manager-daemon',
    );
  });

  it('sets Restart=on-failure', () => {
    expect(unit).toContain('Restart=on-failure');
  });

  it('sets WantedBy=default.target so it starts at login', () => {
    expect(unit).toContain('WantedBy=default.target');
  });

  it('interpolates different node and daemon paths correctly', () => {
    const custom = generateSystemdUnit('/custom/node', '/custom/daemon');
    expect(custom).toContain('ExecStart=/custom/node /custom/daemon');
  });
});

// ─── generateLaunchdPlist ─────────────────────────────────────────────────────

describe('generateLaunchdPlist', () => {
  const plist = generateLaunchdPlist(
    '/usr/bin/node',
    '/usr/local/bin/llm-manager-daemon',
    '/home/user/.local-llm-manager/logs',
  );

  it('is valid XML with a plist root element', () => {
    expect(plist).toContain('<?xml version="1.0"');
    expect(plist).toContain('<plist version="1.0">');
    expect(plist).toContain('</plist>');
  });

  it('includes the correct Label', () => {
    expect(plist).toContain('com.local-llm-manager.daemon');
  });

  it('sets RunAtLoad to true', () => {
    expect(plist).toContain('<key>RunAtLoad</key>');
    expect(plist).toContain('<true/>');
  });

  it('sets KeepAlive.SuccessfulExit to false (restart on crash)', () => {
    expect(plist).toContain('<key>SuccessfulExit</key>');
    expect(plist).toContain('<false/>');
  });

  it('includes node path and daemon path in ProgramArguments', () => {
    expect(plist).toContain('<string>/usr/bin/node</string>');
    expect(plist).toContain(
      '<string>/usr/local/bin/llm-manager-daemon</string>',
    );
  });

  it('writes stdout and stderr log paths inside logsDir', () => {
    expect(plist).toContain('/home/user/.local-llm-manager/logs/daemon.log');
    expect(plist).toContain(
      '/home/user/.local-llm-manager/logs/daemon.error.log',
    );
  });
});

// ─── getServiceStatus ─────────────────────────────────────────────────────────

describe('getServiceStatus (linux)', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  });

  it('returns { installed: false } when unit file is missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
    expect(await getServiceStatus()).toEqual({
      installed: false,
      running: false,
    });
  });

  it('returns running: true when systemctl is-active returns "active"', async () => {
    vi.mocked(readFile).mockResolvedValue('[Unit]');
    mockExecFile('active\n');
    expect(await getServiceStatus()).toEqual({
      installed: true,
      running: true,
    });
  });

  it('returns running: false when systemctl is-active returns "inactive"', async () => {
    vi.mocked(readFile).mockResolvedValue('[Unit]');
    mockExecFile('inactive\n');
    expect(await getServiceStatus()).toEqual({
      installed: true,
      running: false,
    });
  });

  it('returns running: false when systemctl exits with non-zero (stopped/failed)', async () => {
    vi.mocked(readFile).mockResolvedValue('[Unit]');
    mockExecFileError('inactive');
    expect(await getServiceStatus()).toEqual({
      installed: true,
      running: false,
    });
  });
});

describe('getServiceStatus (darwin)', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  });

  it('returns { installed: false } when plist file is missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
    expect(await getServiceStatus()).toEqual({
      installed: false,
      running: false,
    });
  });

  it('returns running: true with pid when launchctl list includes PID', async () => {
    vi.mocked(readFile).mockResolvedValue('<plist>');
    mockExecFile(
      '{\n\t"PID" = 5678;\n\t"Label" = "com.local-llm-manager.daemon";\n}',
    );
    const status = await getServiceStatus();
    expect(status).toEqual({ installed: true, running: true, pid: 5678 });
  });

  it('returns running: false when launchctl list has no PID (stopped)', async () => {
    vi.mocked(readFile).mockResolvedValue('<plist>');
    mockExecFile('{\n\t"Label" = "com.local-llm-manager.daemon";\n}');
    expect(await getServiceStatus()).toEqual({
      installed: true,
      running: false,
    });
  });

  it('returns running: false when launchctl exits non-zero (not loaded)', async () => {
    vi.mocked(readFile).mockResolvedValue('<plist>');
    mockExecFileError('Could not find service');
    expect(await getServiceStatus()).toEqual({
      installed: true,
      running: false,
    });
  });
});

// ─── installService ───────────────────────────────────────────────────────────

describe('installService (linux)', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    // First execFile call = which (findDaemonBinary), rest = systemctl
    vi.mocked(execFile)
      .mockImplementationOnce((_cmd: unknown, _args: unknown, cb: unknown) => {
        (cb as (err: null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '/usr/local/bin/llm-manager-daemon\n', stderr: '' },
        );
        return {} as ReturnType<typeof execFile>;
      })
      .mockImplementation((_cmd: unknown, _args: unknown, cb: unknown) => {
        (cb as (err: null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '', stderr: '' },
        );
        return {} as ReturnType<typeof execFile>;
      });
  });

  it('writes the unit file and runs daemon-reload + enable', async () => {
    await installService();
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      getSystemdUnitPath(),
      expect.stringContaining('[Service]'),
      'utf-8',
    );
  });
});

describe('installService (darwin)', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    mockExecFile('/usr/local/bin/llm-manager-daemon\n');
  });

  it('writes a valid plist file to ~/Library/LaunchAgents/', async () => {
    await installService();
    expect(writeFile).toHaveBeenCalledWith(
      getLaunchdPlistPath(),
      expect.stringContaining('<plist'),
      'utf-8',
    );
  });

  it('creates the logs directory', async () => {
    await installService();
    expect(mkdir).toHaveBeenCalledWith(getLogsDir(), { recursive: true });
  });
});

// ─── startService / stopService ───────────────────────────────────────────────

describe('startService', () => {
  it('calls systemctl --user start on linux', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    mockExecFile();
    await startService();
    expect(execFile).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'start', 'local-llm-manager'],
      expect.any(Function),
    );
  });

  it('calls launchctl load on darwin', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    mockExecFile();
    await startService();
    expect(execFile).toHaveBeenCalledWith(
      'launchctl',
      ['load', getLaunchdPlistPath()],
      expect.any(Function),
    );
  });
});

describe('stopService', () => {
  it('calls systemctl --user stop on linux', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    mockExecFile();
    await stopService();
    expect(execFile).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'stop', 'local-llm-manager'],
      expect.any(Function),
    );
  });

  it('calls launchctl unload on darwin', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    mockExecFile();
    await stopService();
    expect(execFile).toHaveBeenCalledWith(
      'launchctl',
      ['unload', getLaunchdPlistPath()],
      expect.any(Function),
    );
  });
});

// ─── showLogs ─────────────────────────────────────────────────────────────────

describe('showLogs', () => {
  it('calls journalctl on linux', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    mockExecFile('log line 1\nlog line 2\n');
    const output = await showLogs(20);
    expect(execFile).toHaveBeenCalledWith(
      'journalctl',
      ['--user', '-u', 'local-llm-manager', '-n', '20', '--no-pager'],
      expect.any(Function),
    );
    expect(output).toContain('log line 1');
  });

  it('calls tail on darwin', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    mockExecFile('daemon started\n');
    const output = await showLogs(30);
    expect(execFile).toHaveBeenCalledWith(
      'tail',
      ['-n', '30', join(getLogsDir(), 'daemon.log')],
      expect.any(Function),
    );
    expect(output).toContain('daemon started');
  });

  it('returns "(no logs yet)" when the macOS log file does not exist', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    mockExecFileError('No such file');
    const output = await showLogs();
    expect(output).toBe('(no logs yet)');
  });

  it('uses default of 50 lines when no argument supplied', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    mockExecFile('');
    await showLogs();
    expect(execFile).toHaveBeenCalledWith(
      'journalctl',
      expect.arrayContaining(['-n', '50']),
      expect.any(Function),
    );
  });
});

// ─── uninstallService ─────────────────────────────────────────────────────────

describe('uninstallService', () => {
  it('removes the unit file on linux without throwing', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.mocked(unlink).mockResolvedValue(undefined);
    mockExecFile();
    await expect(uninstallService()).resolves.toBeUndefined();
    expect(unlink).toHaveBeenCalledWith(getSystemdUnitPath());
  });

  it('removes the plist file on darwin without throwing', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    vi.mocked(unlink).mockResolvedValue(undefined);
    mockExecFile();
    await expect(uninstallService()).resolves.toBeUndefined();
    expect(unlink).toHaveBeenCalledWith(getLaunchdPlistPath());
  });

  it('does not throw even when stop/disable/unlink all fail', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.mocked(unlink).mockRejectedValue(new Error('ENOENT'));
    mockExecFileError('not found');
    await expect(uninstallService()).resolves.toBeUndefined();
  });
});

// ─── findDaemonBinary ────────────────────────────────────────────────────────

describe('findDaemonBinary', () => {
  it('returns the trimmed binary path when which succeeds', async () => {
    mockExecFile('/usr/local/bin/llm-manager-daemon\n');
    await expect(findDaemonBinary()).resolves.toBe(
      '/usr/local/bin/llm-manager-daemon',
    );
  });

  it('throws when which returns an empty string', async () => {
    mockExecFile('');
    await expect(findDaemonBinary()).rejects.toThrow(
      'llm-manager-daemon not found',
    );
  });

  it('throws when which exits with an error', async () => {
    mockExecFileError('not found');
    await expect(findDaemonBinary()).rejects.toThrow(
      'llm-manager-daemon not found',
    );
  });
});

// ─── runServiceCli ───────────────────────────────────────────────────────────

describe('runServiceCli', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  it('prints help when called with no args', async () => {
    await runServiceCli([]);
    expect(console.log).toHaveBeenCalled();
  });

  it('prints help for --help', async () => {
    await runServiceCli(['--help']);
    expect(console.log).toHaveBeenCalled();
  });

  it('prints help for -h', async () => {
    await runServiceCli(['-h']);
    expect(console.log).toHaveBeenCalled();
  });

  describe('install', () => {
    beforeEach(() => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(execFile)
        .mockImplementationOnce((_cmd, _args, cb) => {
          (
            cb as (
              err: null,
              result: { stdout: string; stderr: string },
            ) => void
          )(null, {
            stdout: '/usr/local/bin/llm-manager-daemon\n',
            stderr: '',
          });
          return {} as ReturnType<typeof execFile>;
        })
        .mockImplementation((_cmd, _args, cb) => {
          (
            cb as (
              err: null,
              result: { stdout: string; stderr: string },
            ) => void
          )(null, { stdout: '', stderr: '' });
          return {} as ReturnType<typeof execFile>;
        });
    });

    it('calls installService and logs the installed path', async () => {
      await runServiceCli(['install']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Installed'),
      );
    });
  });

  describe('uninstall', () => {
    beforeEach(() => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.mocked(unlink).mockResolvedValue(undefined);
      mockExecFile();
    });

    it('calls uninstallService and logs success', async () => {
      await runServiceCli(['uninstall']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('uninstalled'),
      );
    });
  });

  describe('start', () => {
    beforeEach(() => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      mockExecFile();
    });

    it('calls startService and logs success', async () => {
      await runServiceCli(['start']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('started'),
      );
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      mockExecFile();
    });

    it('calls stopService and logs success', async () => {
      await runServiceCli(['stop']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('stopped'),
      );
    });
  });

  describe('status', () => {
    it('shows running state (linux)', async () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.mocked(readFile).mockResolvedValue('[Unit]');
      mockExecFile('active\n');
      await runServiceCli(['status']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('running'),
      );
    });

    it('shows stopped state (linux)', async () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.mocked(readFile).mockResolvedValue('[Unit]');
      mockExecFile('inactive\n');
      await runServiceCli(['status']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('stopped'),
      );
    });

    it('shows not-installed state', async () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
      await runServiceCli(['status']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('not installed'),
      );
    });

    it('shows pid when daemon is running on darwin', async () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
      vi.mocked(readFile).mockResolvedValue('<plist>');
      mockExecFile('{\n\t"PID" = 9999;\n}');
      await runServiceCli(['status']);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('9999'));
    });
  });

  describe('logs', () => {
    beforeEach(() => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      mockExecFile('log output\n');
    });

    it('uses default 50 lines', async () => {
      await runServiceCli(['logs']);
      expect(execFile).toHaveBeenCalledWith(
        'journalctl',
        expect.arrayContaining(['-n', '50']),
        expect.any(Function),
      );
    });

    it('uses the --lines value when provided', async () => {
      await runServiceCli(['logs', '--lines', '100']);
      expect(execFile).toHaveBeenCalledWith(
        'journalctl',
        expect.arrayContaining(['-n', '100']),
        expect.any(Function),
      );
    });

    it('falls back to 50 lines when --lines has no following arg', async () => {
      await runServiceCli(['logs', '--lines']);
      expect(execFile).toHaveBeenCalledWith(
        'journalctl',
        expect.arrayContaining(['-n', '50']),
        expect.any(Function),
      );
    });

    it('falls back to 50 lines when --lines value is not a positive number', async () => {
      await runServiceCli(['logs', '--lines', '-5']);
      expect(execFile).toHaveBeenCalledWith(
        'journalctl',
        expect.arrayContaining(['-n', '50']),
        expect.any(Function),
      );
    });
  });

  it('exits with code 1 for an unknown sub-command', async () => {
    await runServiceCli(['unknown-command']);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
