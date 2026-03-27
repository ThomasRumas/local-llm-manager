import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useScreen } from './hooks/use-screen.js';
import { configService } from './modules/config/config.service.js';
import { ServerProvider } from './contexts/server-context.js';
import { FullScreen } from './components/full-screen.js';
import { Dashboard } from './screens/dashboard.js';
import { InstallCheck } from './screens/install-check.js';
import { SearchModels } from './screens/search-models.js';
import { MyModels } from './screens/my-models.js';
import { ModelConfig } from './screens/model-config.js';
import { ModelLaunch } from './screens/model-launch.js';
import { Settings } from './screens/settings.js';

const HELP: Record<string, Array<{ key: string; label: string }>> = {
  dashboard:      [{ key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'select' }, { key: '1-4', label: 'shortcut' }, { key: 'q', label: 'quit' }],
  install:        [{ key: 'r', label: 'refresh' }, { key: 'i', label: 'install' }, { key: 'Esc', label: 'back' }],
  search:         [{ key: 'Enter', label: 'search/select' }, { key: 'Esc', label: 'back' }],
  'my-models':    [{ key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'select' }, { key: 'Esc', label: 'back' }],
  'model-config': [{ key: '↑↓', label: 'fields' }, { key: '←→', label: 'adjust' }, { key: 'Ctrl+S', label: 'save' }, { key: 'Ctrl+L', label: 'launch' }, { key: 'Esc', label: 'back' }],
  'model-launch': [{ key: '↑↓', label: 'scroll' }, { key: 's', label: 'stop server' }, { key: 'Esc', label: 'back' }],
  settings:       [{ key: '↑↓', label: 'fields' }, { key: '←→', label: 'adjust' }, { key: 'Ctrl+S', label: 'save' }, { key: 'Esc', label: 'back' }],
};

function AppShell() {
  const { screen, params, navigate, goBack } = useScreen();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configService.load()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return <Box><Text color="red">Failed to load config: {error}</Text></Box>;
  }

  if (!ready) {
    return <Box><Text color="cyan">Loading...</Text></Box>;
  }

  const helpItems = HELP[screen] ?? HELP['dashboard']!;

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
      <AppShell />
    </ServerProvider>
  );
}
