import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ResolvedConfig } from '../modules/config/config.types.js';
import { serverManager } from '../modules/server/server-manager.js';
import type { ServerState } from '../modules/server/server-manager.types.js';
import { configService } from '../modules/config/config.service.js';
import {
  fetchDaemonStatus,
  sendDaemonStop,
} from '../modules/api/api.client.js';
export type { ServerState } from '../modules/server/server-manager.types.js';

const DAEMON_POLL_MS = 5000;

interface ServerContextValue extends ServerState {
  start: (
    config: ResolvedConfig,
    modelFile: string,
    configName: string,
  ) => Promise<void>;
  stop: () => void;
}

export const ServerContext = createContext<ServerContextValue>({
  ...serverManager.getState(),
  start: () => Promise.resolve(),
  stop: () => {},
});

export function useServer() {
  return useContext(ServerContext);
}

export function ServerProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<ServerState>(serverManager.getState());

  // Derive the daemon API port once. configService.get() is synchronous and
  // config is always loaded before ServerProvider renders (see app.tsx), so
  // lazy state initialisation (function passed to useState) is the right tool:
  // it runs once, never inside an effect body, and avoids cascading renders.
  const [daemonPort] = useState<number | null>(() => {
    try {
      return configService.get().apiServer.port;
    } catch {
      return null;
    }
  });

  // Subscribe to local serverManager state changes.
  useEffect(() => {
    const onStateChanged = (newState: ServerState) => setState(newState);
    serverManager.on('state-changed', onStateChanged);
    return () => {
      serverManager.off('state-changed', onStateChanged);
    };
  }, []);

  // Poll the daemon's /api/status when:
  //   - daemonPort is known (set above)
  //   - the TUI does NOT own a local server process (processRef is null →
  //     state.daemonManaged OR state.running===false)
  const pollDaemon = useCallback(() => {
    if (daemonPort === null) return;
    // If the TUI owns the process locally, its state is authoritative — skip.
    if (state.running && !state.daemonManaged) return;

    fetchDaemonStatus(daemonPort).then((status) => {
      if (status === null) {
        // Daemon unreachable — clear any stale daemon state.
        serverManager.clearDaemonState();
        return;
      }
      if (status.running) {
        serverManager.syncFromDaemon(status);
      } else {
        serverManager.clearDaemonState();
      }
    });
  }, [daemonPort, state.running, state.daemonManaged]);

  useEffect(() => {
    if (daemonPort === null) return;
    // Immediate first poll so the TUI reflects daemon state on startup.
    pollDaemon();
    const id = setInterval(pollDaemon, DAEMON_POLL_MS);
    return () => clearInterval(id);
  }, [daemonPort, pollDaemon]);

  // start(): stable reference — serverManager is a module-level singleton,
  // so binding once and never recreating prevents churn in children that
  // depend on the start function reference.
  const start = useCallback(
    (config: ResolvedConfig, modelFile: string, configName: string) =>
      serverManager.start(config, modelFile, configName),
    [],
  );

  // stop(): if daemon-managed, route through the daemon API; otherwise kill
  // the local process.
  const stop = useCallback(() => {
    if (state.daemonManaged && daemonPort !== null) {
      sendDaemonStop(daemonPort).then(() => {
        // Poll immediately after stop so the header updates without waiting
        // for the next 5 s tick.
        pollDaemon();
      });
    } else {
      serverManager.stop();
    }
  }, [state.daemonManaged, daemonPort, pollDaemon]);

  const value = useMemo(
    () => ({
      ...state,
      start,
      stop,
    }),
    [state, start, stop],
  );

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
}
