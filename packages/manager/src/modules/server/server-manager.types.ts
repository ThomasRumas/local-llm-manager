export interface ServerState {
  running: boolean;
  modelFile: string | null;
  configName: string | null;
  port: number | null;
  pid: number | null;
  uptimeSeconds: number;
  logs: string[];
  error: string | null;
  /** True when the running llama-server was started by the background daemon,
   *  not by this TUI process. The TUI does not own the child process and must
   *  route stop requests through the daemon API instead of killing directly. */
  daemonManaged: boolean;
}
