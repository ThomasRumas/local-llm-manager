import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ResolvedConfig } from '../modules/config/config.types.js';
import { serverManager } from '../modules/server/server-manager.js';
import type { ServerState } from '../modules/server/server-manager.types.js';
export type { ServerState } from '../modules/server/server-manager.types.js';

interface ServerContextValue extends ServerState {
  start: (
    config: ResolvedConfig,
    modelFile: string,
    configName: string,
  ) => void;
  stop: () => void;
}

export const ServerContext = createContext<ServerContextValue>({
  ...serverManager.getState(),
  start: () => {},
  stop: () => {},
});

export function useServer() {
  return useContext(ServerContext);
}

export function ServerProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<ServerState>(serverManager.getState());

  useEffect(() => {
    const onStateChanged = (newState: ServerState) => setState(newState);
    serverManager.on('state-changed', onStateChanged);
    return () => {
      serverManager.off('state-changed', onStateChanged);
    };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      start: serverManager.start.bind(serverManager),
      stop: serverManager.stop.bind(serverManager),
    }),
    [state],
  );

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
}
