import React, { createContext, useContext } from 'react';
import {
  useServiceStatus,
  type ServiceStatusState,
} from '../hooks/use-service-status.js';

// Re-export the type so consumers don't need to import from the hook directly.
export type { ServiceStatusState };

interface ServiceStatusContextValue extends ServiceStatusState {
  refresh: () => void;
}

const DEFAULT: ServiceStatusContextValue = {
  installed: false,
  running: false,
  pid: undefined,
  loading: true,
  error: null,
  refresh: () => {},
};

const ServiceStatusContext = createContext<ServiceStatusContextValue>(DEFAULT);

export function useServiceStatusContext() {
  return useContext(ServiceStatusContext);
}

export function ServiceStatusProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const value = useServiceStatus();
  return (
    <ServiceStatusContext.Provider value={value}>
      {children}
    </ServiceStatusContext.Provider>
  );
}
