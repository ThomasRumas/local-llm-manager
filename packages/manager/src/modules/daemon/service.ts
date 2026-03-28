import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const execFileAsync = promisify(execFile);

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEMD_SERVICE_NAME = 'local-llm-manager';
const LAUNCHD_LABEL = 'com.local-llm-manager.daemon';

// ─── Platform ────────────────────────────────────────────────────────────────

export function detectPlatform(): 'linux' | 'darwin' {
  if (process.platform === 'linux') return 'linux';
  if (process.platform === 'darwin') return 'darwin';
  throw new Error(
    `Unsupported platform: ${process.platform}. Only Linux (systemd) and macOS (launchd) are supported.`,
  );
}

// ─── Paths ───────────────────────────────────────────────────────────────────

export function getSystemdUnitPath(): string {
  return join(
    homedir(),
    '.config',
    'systemd',
    'user',
    `${SYSTEMD_SERVICE_NAME}.service`,
  );
}

export function getLaunchdPlistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`);
}

export function getLogsDir(): string {
  return join(homedir(), '.local-llm-manager', 'logs');
}

// ─── Binary discovery ────────────────────────────────────────────────────────

export async function findDaemonBinary(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('which', ['llm-manager-daemon']);
    const path = stdout.trim();
    if (!path) throw new Error('empty output');
    return path;
  } catch {
    throw new Error(
      'llm-manager-daemon not found on PATH. Install it first:\n' +
        '  npm install -g @thomasrumas/llm-manager',
    );
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function generateSystemdUnit(
  nodePath: string,
  daemonPath: string,
): string {
  return `[Unit]
Description=Local LLM Manager Daemon
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${daemonPath}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;
}

export function generateLaunchdPlist(
  nodePath: string,
  daemonPath: string,
  logsDir: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${daemonPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${logsDir}/daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${logsDir}/daemon.error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
`;
}

// ─── Service lifecycle ───────────────────────────────────────────────────────

export async function installService(): Promise<void> {
  const platform = detectPlatform();
  const daemonPath = await findDaemonBinary();
  const nodePath = process.execPath;

  if (platform === 'linux') {
    const unitPath = getSystemdUnitPath();
    await mkdir(dirname(unitPath), { recursive: true });
    await writeFile(
      unitPath,
      generateSystemdUnit(nodePath, daemonPath),
      'utf-8',
    );
    await execFileAsync('systemctl', ['--user', 'daemon-reload']);
    await execFileAsync('systemctl', [
      '--user',
      'enable',
      SYSTEMD_SERVICE_NAME,
    ]);
    console.log(`✔ Installed: ${unitPath}`);
    console.log(`✔ Enabled to start at login`);
  } else {
    const logsDir = getLogsDir();
    await mkdir(logsDir, { recursive: true });
    const plistPath = getLaunchdPlistPath();
    await mkdir(dirname(plistPath), { recursive: true });
    await writeFile(
      plistPath,
      generateLaunchdPlist(nodePath, daemonPath, logsDir),
      'utf-8',
    );
    console.log(`✔ Installed: ${plistPath}`);
    console.log(`✔ Will start automatically at login (RunAtLoad=true)`);
  }
}

export async function uninstallService(): Promise<void> {
  const platform = detectPlatform();

  if (platform === 'linux') {
    try {
      await execFileAsync('systemctl', [
        '--user',
        'stop',
        SYSTEMD_SERVICE_NAME,
      ]);
    } catch {
      // already stopped — ignore
    }
    try {
      await execFileAsync('systemctl', [
        '--user',
        'disable',
        SYSTEMD_SERVICE_NAME,
      ]);
    } catch {
      // already disabled — ignore
    }
    try {
      await unlink(getSystemdUnitPath());
    } catch {
      // file may not exist — ignore
    }
    try {
      await execFileAsync('systemctl', ['--user', 'daemon-reload']);
    } catch {
      // best-effort reload — ignore
    }
  } else {
    try {
      await execFileAsync('launchctl', ['unload', getLaunchdPlistPath()]);
    } catch {
      // not loaded — ignore
    }
    try {
      await unlink(getLaunchdPlistPath());
    } catch {
      // file may not exist — ignore
    }
  }

  console.log('✔ Service uninstalled');
}

export async function startService(): Promise<void> {
  const platform = detectPlatform();

  if (platform === 'linux') {
    await execFileAsync('systemctl', ['--user', 'start', SYSTEMD_SERVICE_NAME]);
  } else {
    await execFileAsync('launchctl', ['load', getLaunchdPlistPath()]);
  }
}

export async function stopService(): Promise<void> {
  const platform = detectPlatform();

  if (platform === 'linux') {
    await execFileAsync('systemctl', ['--user', 'stop', SYSTEMD_SERVICE_NAME]);
  } else {
    await execFileAsync('launchctl', ['unload', getLaunchdPlistPath()]);
  }
}

export interface ServiceStatus {
  installed: boolean;
  running: boolean;
  pid?: number;
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  const platform = detectPlatform();

  if (platform === 'linux') {
    try {
      await readFile(getSystemdUnitPath(), 'utf-8');
    } catch {
      return { installed: false, running: false };
    }
    try {
      const { stdout } = await execFileAsync('systemctl', [
        '--user',
        'is-active',
        SYSTEMD_SERVICE_NAME,
      ]);
      return { installed: true, running: stdout.trim() === 'active' };
    } catch {
      return { installed: true, running: false };
    }
  } else {
    try {
      await readFile(getLaunchdPlistPath(), 'utf-8');
    } catch {
      return { installed: false, running: false };
    }
    try {
      const { stdout } = await execFileAsync('launchctl', [
        'list',
        LAUNCHD_LABEL,
      ]);
      // launchctl list output contains "PID" = <number>; when the job is running
      const pidMatch = /"PID" = (\d+);/.exec(stdout);
      const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;
      return { installed: true, running: pid !== undefined, pid };
    } catch {
      // launchctl list exits non-zero when the job is not loaded
      return { installed: true, running: false };
    }
  }
}

export async function showLogs(lines: number = 50): Promise<string> {
  const platform = detectPlatform();

  if (platform === 'linux') {
    const { stdout } = await execFileAsync('journalctl', [
      '--user',
      '-u',
      SYSTEMD_SERVICE_NAME,
      '-n',
      String(lines),
      '--no-pager',
    ]);
    return stdout;
  } else {
    const logFile = join(getLogsDir(), 'daemon.log');
    try {
      const { stdout } = await execFileAsync('tail', [
        '-n',
        String(lines),
        logFile,
      ]);
      return stdout;
    } catch {
      return '(no logs yet)';
    }
  }
}

// ─── CLI handler (called from llm-manager binary) ────────────────────────────

const c = {
  bold: '\x1b[1m',
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m',
};

function printServiceHelp(): void {
  console.log(`
${c.bold}llm-manager service${c.reset} — Manage the LLM Manager daemon

${c.bold}Usage:${c.reset}
  llm-manager service ${c.cyan}<subcommand>${c.reset}

${c.bold}Subcommands:${c.reset}
  ${c.cyan}install${c.reset}              Install as a system service Linux(systemd)/ MacOS(launchd) and enable at login
  ${c.cyan}uninstall${c.reset}            Remove the system service
  ${c.cyan}start${c.reset}                Start the service
  ${c.cyan}stop${c.reset}                 Stop the service
  ${c.cyan}status${c.reset}               Show installation and running state
  ${c.cyan}logs${c.reset} [--lines <n>]   Tail daemon logs (default: 50 lines)

${c.bold}Examples:${c.reset}
  llm-manager service install
  llm-manager service start
  llm-manager service status
  llm-manager service logs --lines 100
  llm-manager service stop
  llm-manager service uninstall
`);
}

export async function runServiceCli(args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    printServiceHelp();
    return;
  }

  if (sub === 'install') {
    await installService();
    return;
  }

  if (sub === 'uninstall') {
    await uninstallService();
    return;
  }

  if (sub === 'start') {
    await startService();
    console.log(`${c.green}✔${c.reset} Service started`);
    return;
  }

  if (sub === 'stop') {
    await stopService();
    console.log(`${c.green}✔${c.reset} Service stopped`);
    return;
  }

  if (sub === 'status') {
    const platform = detectPlatform();
    const status = await getServiceStatus();
    const platformLabel = `${c.gray}(${platform})${c.reset}`;
    console.log(`\n${c.bold}Service Status${c.reset} ${platformLabel}`);
    const installedLabel = status.installed
      ? `${c.green}✔ installed${c.reset}`
      : `${c.yellow}✖ not installed${c.reset}`;
    console.log(`  ${c.cyan}installed${c.reset}  ${installedLabel}`);
    if (status.installed) {
      const runningLabel = status.running
        ? `${c.green}● running${c.reset}`
        : `${c.gray}● stopped${c.reset}`;
      console.log(`  ${c.cyan}state${c.reset}      ${runningLabel}`);
      if (status.pid !== undefined) {
        console.log(`  ${c.cyan}pid${c.reset}        ${status.pid}`);
      }
    }
    console.log('');
    return;
  }

  if (sub === 'logs') {
    let lines = 50;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--lines' && args[i + 1]) {
        const n = parseInt(args[i + 1], 10);
        if (!isNaN(n) && n > 0) lines = n;
        i++;
      }
    }
    const output = await showLogs(lines);
    process.stdout.write(output);
    return;
  }

  const validSubs = 'install | uninstall | start | stop | status | logs';
  console.error(`${c.red}✖ Unknown service sub-command: ${sub}${c.reset}`);
  console.error(`  Valid sub-commands: ${validSubs}`);
  process.exit(1);
}
