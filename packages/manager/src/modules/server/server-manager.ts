import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { llamaService } from '../llama/llama.service.js';
import type { ResolvedConfig } from '../config/config.types.js';
import type { ServerState } from './server-manager.types.js';
import type { ApiStatusResponse } from '../api/api.types.js';

const MAX_LOGS = 500;

const INITIAL_STATE: ServerState = {
  running: false,
  modelFile: null,
  configName: null,
  port: null,
  pid: null,
  uptimeSeconds: 0,
  logs: [],
  error: null,
  daemonManaged: false,
};

export class ServerManager extends EventEmitter {
  private state: ServerState = { ...INITIAL_STATE };
  private processRef: ChildProcess | null = null;
  private uptimeInterval: ReturnType<typeof setInterval> | null = null;

  getState(): ServerState {
    return { ...this.state };
  }

  private setState(patch: Partial<ServerState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('state-changed', this.getState());
  }

  private clearUptime(): void {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }
  }

  /**
   * Kill a child process and its entire process group.
   * Because llama-server may be launched via a Homebrew wrapper script,
   * sending SIGTERM only to the wrapper leaves the real binary running as an
   * orphan. Killing by negative PGID (process group) terminates every process
   * in the group. Falls back to a direct kill if the PID is unavailable.
   */
  private killProcess(proc: ChildProcess): void {
    if (proc.pid != null) {
      try {
        process.kill(-proc.pid, 'SIGTERM');
        return;
      } catch {
        // PGID may not exist if the process already exited; fall through
      }
    }
    try {
      proc.kill('SIGTERM');
    } catch {
      // already gone
    }
  }

  async start(
    config: ResolvedConfig,
    modelFile: string,
    configName: string,
  ): Promise<void> {
    // Stop any existing server first
    if (this.processRef) {
      this.killProcess(this.processRef);
      this.processRef = null;
    }
    this.clearUptime();

    const { process: proc } = await llamaService.launch(config);
    this.processRef = proc;

    this.setState({
      running: Boolean(proc.pid),
      modelFile,
      configName,
      port: config.port,
      pid: proc.pid ?? null,
      uptimeSeconds: 0,
      logs: [`[info] Starting llama-server on port ${config.port}...`],
      error: null,
      daemonManaged: false,
    });

    this.uptimeInterval = setInterval(() => {
      this.setState({ uptimeSeconds: this.state.uptimeSeconds + 1 });
    }, 1000);

    const addLog = (data: string) => {
      const lines = data.split('\n').filter((l) => l.trim());
      const logs = [...this.state.logs, ...lines].slice(-MAX_LOGS);
      this.setState({ logs });
    };

    proc.stdout?.on('data', (chunk: Buffer) => addLog(chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => addLog(chunk.toString()));

    proc.on('close', (code) => {
      if (this.processRef !== proc) return;
      this.clearUptime();
      this.processRef = null;
      this.setState({
        running: false,
        pid: null,
        error: null,
        logs: [
          ...this.state.logs,
          `[info] Server exited with code ${code ?? '(signal)'}`,
        ],
      });
    });

    proc.on('error', (err) => {
      if (this.processRef !== proc) return;
      this.clearUptime();
      this.processRef = null;
      this.setState({
        running: false,
        pid: null,
        error: err.message,
        logs: [...this.state.logs, `[error] ${err.message}`],
      });
    });
  }

  stop(): void {
    if (this.processRef) {
      this.killProcess(this.processRef);
      this.processRef = null;
    }
    this.clearUptime();
    this.setState({
      running: false,
      pid: null,
      uptimeSeconds: 0,
      error: null,
      daemonManaged: false,
    });
  }

  /**
   * Sync TUI display state from a live `GET /api/status` response when a
   * background daemon is managing the llama-server process. The TUI does not
   * own the child process so `processRef` is left null.
   */
  syncFromDaemon(status: ApiStatusResponse): void {
    this.setState({
      running: status.running,
      modelFile: status.modelFile,
      configName: status.configName,
      port: status.port,
      pid: status.pid,
      uptimeSeconds: status.uptimeSeconds,
      error: status.error,
      logs: status.logs,
      daemonManaged: true,
    });
  }

  /**
   * Reset to initial state when the daemon reports no server is running and
   * the current state was set by a previous `syncFromDaemon()` call.
   */
  clearDaemonState(): void {
    if (this.state.daemonManaged) {
      this.setState({ ...INITIAL_STATE });
    }
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}

export const serverManager = new ServerManager();
