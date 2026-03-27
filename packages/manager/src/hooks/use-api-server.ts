import { useEffect, useState } from 'react';
import { apiServer } from '../modules/api/api.server.js';

interface ApiServerState {
  isRunning: boolean;
  port: number | null;
}

export function useApiServer(): ApiServerState {
  const [state, setState] = useState<ApiServerState>({
    isRunning: apiServer.isRunning,
    port: apiServer.port,
  });

  useEffect(() => {
    const onchange = () =>
      setState({ isRunning: apiServer.isRunning, port: apiServer.port });
    apiServer.on('change', onchange);
    return () => {
      apiServer.off('change', onchange);
    };
  }, []);

  return state;
}
