import type React from 'react';
import { Box, Text } from 'ink';
import { useWindowSize } from '../hooks/use-window-size.js';
import { useServer } from '../contexts/server-context.js';
import { useApiServer } from '../hooks/use-api-server.js';
import { useServiceStatusContext } from '../contexts/service-status-context.js';
import { configService } from '../modules/config/config.service.js';
import type { Screen } from '../hooks/use-screen.js';

const SCREEN_LABELS: Record<Screen, string> = {
  dashboard: 'Dashboard',
  install: 'Install / Check',
  search: 'Search Models',
  'my-models': 'My Models',
  'model-config': 'Configure Model',
  'model-launch': 'Server Monitor',
  settings: 'Settings',
  service: 'Service',
};

interface FullScreenProps {
  screen: Screen;
  helpItems: Array<{ key: string; label: string }>;
  children: React.ReactNode;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function FullScreen({
  screen,
  helpItems,
  children,
}: Readonly<FullScreenProps>) {
  const { columns, rows } = useWindowSize();
  const server = useServer();
  const apiStatus = useApiServer();
  const serviceStatus = useServiceStatusContext();

  const screenLabel = SCREEN_LABELS[screen] ?? screen;
  const headerLeft = `  🦙 Local LLM Manager  │  ${screenLabel}`;
  const serverDot = server.running ? '●' : '○';
  const serverColor = server.running ? 'green' : 'gray';
  const serverDisplayName = server.modelFile
    ? configService.getModelDisplayName(
        server.modelFile,
        server.configName ?? 'default',
      )
    : null;
  const serverInfo = server.running
    ? `${serverDisplayName}  :${server.port}  ${formatUptime(server.uptimeSeconds)}`
    : 'No server running';

  const apiDot = apiStatus.isRunning ? '●' : '○';
  const apiColor = apiStatus.isRunning ? 'cyan' : 'gray';
  const apiInfo = apiStatus.isRunning ? `:${apiStatus.port}` : 'off';

  const serviceDot = serviceStatus.loading
    ? '…'
    : serviceStatus.running
      ? '●'
      : serviceStatus.installed
        ? '○'
        : '✗';
  const serviceColor = serviceStatus.loading
    ? 'gray'
    : serviceStatus.running
      ? 'green'
      : serviceStatus.installed
        ? 'yellow'
        : 'gray';
  const serviceInfo = serviceStatus.loading
    ? ''
    : serviceStatus.running
      ? 'running'
      : serviceStatus.installed
        ? 'stopped'
        : 'not installed';

  return (
    <Box flexDirection="column" width={columns || 80} height={rows || 24}>
      {/* ── Header ───────────────────────────────────────── */}
      <Box
        borderStyle="single"
        borderBottom
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        paddingX={1}
        justifyContent="space-between"
      >
        <Text bold color="cyan">
          {headerLeft}
        </Text>
        <Box gap={2}>
          <Box gap={1}>
            <Text color={serviceColor}>{serviceDot}</Text>
            <Text color="gray">SVC</Text>
            <Text color={serviceColor}>{serviceInfo}</Text>
          </Box>
          <Text color="gray">│</Text>
          <Box gap={1}>
            <Text color={apiColor}>{apiDot}</Text>
            <Text color="gray">API</Text>
            <Text color={apiColor}>{apiInfo}</Text>
          </Box>
          <Text color="gray">│</Text>
          <Box gap={1}>
            <Text color={serverColor}>{serverDot}</Text>
            <Text color="gray" wrap="truncate">
              {serverInfo}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* ── Content ──────────────────────────────────────── */}
      <Box flexGrow={1} overflow="hidden" paddingX={1} paddingY={1}>
        {children}
      </Box>

      {/* ── Footer ───────────────────────────────────────── */}
      <Box
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        paddingX={1}
        gap={3}
      >
        {helpItems.map((item) => (
          <Box key={item.key} gap={1}>
            <Text bold color="yellow">
              {item.key}
            </Text>
            <Text color="gray">{item.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
