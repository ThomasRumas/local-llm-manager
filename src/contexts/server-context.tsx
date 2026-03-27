import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ChildProcess } from 'node:child_process';
import { llamaService } from '../modules/llama/llama.service.js';
import type { ResolvedConfig } from '../modules/config/config.types.js';

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

interface ServerContextValue extends ServerState {
  start: (config: ResolvedConfig, modelFile: string, configName: string) => void;
  stop: () => void;
}

const initialState: ServerState = {
  running: false,
  modelFile: null,
  configName: null,
  port: null,
  pid: null,
  uptimeSeconds: 0,
  logs: [],
  error: null,
};

export const ServerContext = createContext<ServerContextValue>({
  ...initialState,
  start: () => {},
  stop: () => {},
});

export function useServer() {
  return useContext(ServerContext);
}

const MAX_LOGS = 500;

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ServerState>(initialState);
  const processRef = useRef<ChildProcess | null>(null);
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearUptime = () => {
    if (uptimeRef.current) {
      clearInterval(uptimeRef.current);
      uptimeRef.current = null;
    }
  };

  const stop = useCallback(() => {
    if (processRef.current) {
      processRef.current.kill('SIGTERM');
      processRef.current = null;
    }
    clearUptime();
    setState((prev) => ({ ...prev, running: false, pid: null, uptimeSeconds: 0 }));
  }, []);

  const start = useCallback((config: ResolvedConfig, modelFile: string, configName: string) => {
    // Stop any existing server first
    if (processRef.current) {
      processRef.current.kill('SIGTERM');
      processRef.current = null;
    }
    clearUptime();

    const { process: proc } = llamaService.launch(config);
    processRef.current = proc;

    setState({
      running: Boolean(proc.pid),
      modelFile,
      configName,
      port: config.port,
      pid: proc.pid ?? null,
      uptimeSeconds: 0,
      logs: [`[info] Starting llama-server on port ${config.port}...`],
      error: null,
    });

    uptimeRef.current = setInterval(() => {
      setState((prev) => ({ ...prev, uptimeSeconds: prev.uptimeSeconds + 1 }));
    }, 1000);

    const addLog = (data: string) => {
      const lines = data.split('\n').filter((l) => l.trim());
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, ...lines].slice(-MAX_LOGS),
      }));
    };

    proc.stdout?.on('data', (chunk: Buffer) => addLog(chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => addLog(chunk.toString()));

    proc.on('close', (code) => {
      // Guard: ignore close events from a process that was already replaced
      if (processRef.current !== proc) return;
      clearUptime();
      processRef.current = null;
      setState((prev) => ({
        ...prev,
        running: false,
        pid: null,
        logs: [...prev.logs, `[info] Server exited with code ${code}`],
      }));
    });

    proc.on('error', (err) => {
      // Guard: ignore error events from a process that was already replaced
      if (processRef.current !== proc) return;
      clearUptime();
      processRef.current = null;
      setState((prev) => ({
        ...prev,
        running: false,
        pid: null,
        error: err.message,
        logs: [...prev.logs, `[error] ${err.message}`],
      }));
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearUptime();
      if (processRef.current) {
        processRef.current.kill('SIGTERM');
      }
    };
  }, []);

  return (
    <ServerContext.Provider value={{ ...state, start, stop }}>
      {children}
    </ServerContext.Provider>
  );
}
