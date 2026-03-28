import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useScreen } from './hooks/use-screen.js';
import { configService } from './modules/config/config.service.js';
import { apiServer } from './modules/api/api.server.js';
import { ServerProvider } from './contexts/server-context.js';
import { ServiceStatusProvider } from './contexts/service-status-context.js';
import { FullScreen } from './components/full-screen.js';
import { Dashboard } from './screens/dashboard.js';
import { InstallCheck } from './screens/install-check.js';
import { SearchModels } from './screens/search-models.js';
import { MyModels } from './screens/my-models.js';
import { ModelConfig } from './screens/model-config.js';
import { ModelLaunch } from './screens/model-launch.js';
import { Settings } from './screens/settings.js';
import { ServiceManager } from './screens/service-manager.js';

const HELP: Record<string, Array<{ key: string; label: string }>> = {
  dashboard: [
    { key: '↑↓', label: 'navigate' },
    { key: 'Enter', label: 'select' },
    { key: '1-4', label: 'shortcut' },
    { key: 'q', label: 'quit' },
  ],
  install: [
    { key: 'r', label: 'refresh' },
    { key: 'i', label: 'install' },
    { key: 'Esc', label: 'back' },
  ],
  search: [
    { key: 'Enter', label: 'search/select' },
    { key: 'Esc', label: 'back' },
  ],
  'my-models': [
    { key: '↑↓', label: 'navigate' },
    { key: 'Enter', label: 'select' },
    { key: 'Esc', label: 'back' },
  ],
  'model-config': [
    { key: '↑↓', label: 'fields' },
    { key: '←→', label: 'adjust' },
    { key: 'Ctrl+S', label: 'save' },
    { key: 'Ctrl+L', label: 'launch' },
    { key: 'Esc', label: 'back' },
  ],
  'model-launch': [
    { key: '↑↓', label: 'scroll' },
    { key: 's', label: 'stop server' },
    { key: 'Esc', label: 'back' },
  ],
  settings: [
    { key: '↑↓', label: 'fields' },
    { key: '←→', label: 'adjust' },
    { key: 'Ctrl+S', label: 'save' },
    { key: 'Esc', label: 'back' },
  ],
  service: [
    { key: 'i', label: 'install' },
    { key: 'u', label: 'uninstall' },
    { key: 's', label: 'start/stop' },
    { key: 'r', label: 'refresh' },
    { key: 'Esc', label: 'back' },
  ],
};

function AppShell() {
  const { screen, params, navigate, goBack } = useScreen();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configService
      .load()
      .then((config) => {
        setReady(true);
        if (config.apiServer.enabled) {
          return apiServer.start(config.apiServer.port);
        }
      })
      .catch((err: unknown) => {
        // EADDRINUSE means the daemon is already running on this port — the
        // TUI does not need its own API server in that case, so just continue.
        if (
          err instanceof Error &&
          (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      apiServer.stop();
    };
  }, []);

  if (error) {
    return (
      <Box>
        <Text color="red">Failed to load config: {error}</Text>
      </Box>
    );
  }

  if (!ready) {
    return (
      <Box>
        <Text color="cyan">Loading...</Text>
      </Box>
    );
  }

  const helpItems = HELP[screen] ?? HELP['dashboard'];

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'install':
        return <InstallCheck onBack={goBack} />;
      case 'search':
        return <SearchModels onBack={goBack} />;
      case 'my-models':
        return <MyModels onBack={goBack} onNavigate={navigate} />;
      case 'model-config':
        return (
          <ModelConfig
            modelFile={params.modelFile!}
            configName={params.configName}
            onBack={goBack}
            onNavigate={navigate}
          />
        );
      case 'model-launch':
        return (
          <ModelLaunch
            modelFile={params.modelFile}
            configName={params.configName}
            onBack={goBack}
          />
        );
      case 'settings':
        return <Settings onBack={goBack} />;
      case 'service':
        return <ServiceManager onBack={goBack} />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <FullScreen screen={screen} helpItems={helpItems}>
      {renderScreen()}
    </FullScreen>
  );
}

export function App() {
  return (
    <ServerProvider>
      <ServiceStatusProvider>
        <AppShell />
      </ServiceStatusProvider>
    </ServerProvider>
  );
}
