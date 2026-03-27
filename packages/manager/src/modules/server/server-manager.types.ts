export interface ServerState {
  running: boolean;
  modelFile: string | null;
  configName: string | null;
  port: number | null;
  pid: number | null;
  uptimeSeconds: number;
  logs: string[];
  error: string | null;
}
