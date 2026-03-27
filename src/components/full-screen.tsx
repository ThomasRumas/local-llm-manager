import React from 'react';
import { Box, Text } from 'ink';
import { useWindowSize } from '../hooks/use-window-size.js';
import { useServer } from '../contexts/server-context.js';
import type { Screen } from '../hooks/use-screen.js';

const SCREEN_LABELS: Record<Screen, string> = {
  dashboard: 'Dashboard',
  install: 'Install / Check',
  search: 'Search Models',
  'my-models': 'My Models',
  'model-config': 'Configure Model',
  'model-launch': 'Server Monitor',
  settings: 'Settings',
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

export function FullScreen({ screen, helpItems, children }: FullScreenProps) {
  const { columns, rows } = useWindowSize();
  const server = useServer();

  const screenLabel = SCREEN_LABELS[screen] ?? screen;
  const headerLeft = `  🦙 Local LLM Manager  │  ${screenLabel}`;
  const serverDot = server.running ? '●' : '○';
  const serverColor = server.running ? 'green' : 'gray';
  const serverInfo = server.running
    ? `${server.modelFile?.replace(/\.gguf$/, '')}  :${server.port}  ${formatUptime(server.uptimeSeconds)}`
    : 'No server running';

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
        <Text bold color="cyan">{headerLeft}</Text>
        <Box gap={1}>
          <Text color={serverColor}>{serverDot}</Text>
          <Text color="gray" wrap="truncate">{serverInfo}</Text>
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
            <Text bold color="yellow">{item.key}</Text>
            <Text color="gray">{item.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
