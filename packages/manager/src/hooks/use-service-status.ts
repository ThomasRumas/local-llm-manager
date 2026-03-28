import { useState, useEffect, useCallback } from 'react';
import {
  getServiceStatus,
  type ServiceStatus,
} from '../modules/daemon/service.js';

interface ServiceStatusState extends ServiceStatus {
  loading: boolean;
  error: string | null;
}

export type { ServiceStatusState };

const INITIAL_STATE: ServiceStatusState = {
  installed: false,
  running: false,
  pid: undefined,
  loading: true,
  error: null,
};

const POLL_INTERVAL_MS = 5000;

export function useServiceStatus(): ServiceStatusState & {
  refresh: () => void;
} {
  const [state, setState] = useState<ServiceStatusState>(INITIAL_STATE);

  // Pure async fetch — no synchronous setState, safe to call inside an effect.
  const fetchStatus = useCallback(() => {
    getServiceStatus()
      .then((status) => setState({ ...status, loading: false, error: null }))
      .catch((err: unknown) =>
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        })),
      );
  }, []);

  // Public refresh: marks loading, then re-fetches. Called from the interval
  // callback (not directly from an effect body) so the sync setState is fine.
  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    // Initial fetch — only async setState, satisfies react-hooks/set-state-in-effect.
    fetchStatus();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus, refresh]);

  return { ...state, refresh };
}
