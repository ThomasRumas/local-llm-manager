import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useServer } from '../contexts/server-context.js';
import { configService } from '../modules/config/config.service.js';
import { useSystemStats } from '../hooks/use-system-stats.js';
import type { Screen } from '../hooks/use-screen.js';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

type Action = { key: string; shortcut: string; screen: Screen; label: string };

const ACTIONS: Action[] = [
  { key: '1', shortcut: '1', screen: 'install',    label: 'Install / Check llama.cpp' },
  { key: '2', shortcut: '2', screen: 'search',     label: 'Search Models (Hugging Face)' },
  { key: '3', shortcut: '3', screen: 'my-models',  label: 'My Models' },
  { key: '4', shortcut: '4', screen: 'settings',   label: 'Settings' },
];

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatGb(bytes: number): string {
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const server = useServer();
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stats = useSystemStats(null, 5000);
  const hfToken = configService.getHfToken();
  const hasHfToken = !!hfToken;

  useInput((input, key) => {
    if (input === 'q') { exit(); return; }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : ACTIONS.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < ACTIONS.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const action = ACTIONS[selectedIndex];
      if (action) onNavigate(action.screen);
    }

    const shortcutAction = ACTIONS.find((a) => a.shortcut === input);
    if (shortcutAction) onNavigate(shortcutAction.screen);

    // Jump to monitor if server is running
    if (input === 'm' && server.running) onNavigate('model-launch');
  });

  const recentLogs = server.logs.slice(-6);

  return (
    <Box flexDirection="row" gap={2} height="100%">
      {/* Left column */}
      <Box flexDirection="column" gap={1} width="50%">
        {/* HF Token Status Panel */}
        <Box
          borderStyle="round"
          borderColor={hasHfToken ? 'green' : 'yellow'}
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color={hasHfToken ? 'green' : 'yellow'}>
            {hasHfToken ? '● Hugging Face Token Set' : '○ No Hugging Face Token'}
          </Text>
          {hasHfToken ? (
            <Text dimColor>
              {`hf_${'*'.repeat(Math.max(0, hfToken.length - 3))}${hfToken.slice(-3)}`}
            </Text>
          ) : (
            <Text dimColor>Set a token in Settings [4] to access private repos</Text>
          )}
        </Box>

        {/* Server Status Panel */}
        <Box borderStyle="round" borderColor={server.running ? 'green' : 'gray'} flexDirection="column" paddingX={1}>
          <Text bold color={server.running ? 'green' : 'gray'}>
            {server.running ? '● Server Running' : '○ No Server Running'}
          </Text>
          {server.running ? (
            <Box flexDirection="column" marginTop={1} gap={0}>
              <Box gap={2}>
                <Box width={12}><Text dimColor>Model</Text></Box>
                <Text wrap="truncate">{server.modelFile?.replace(/\.gguf$/, '') ?? '—'}</Text>
              </Box>
              <Box gap={2}>
                <Box width={12}><Text dimColor>Port</Text></Box>
                <Text color="cyan">:{server.port}</Text>
              </Box>
              <Box gap={2}>
                <Box width={12}><Text dimColor>Uptime</Text></Box>
                <Text color="green">{formatUptime(server.uptimeSeconds)}</Text>
              </Box>
              {server.pid && (
                <Box gap={2}>
                  <Box width={12}><Text dimColor>PID</Text></Box>
                  <Text color="gray">{server.pid}</Text>
                </Box>
              )}
              {server.configName && (
                <Box gap={2}>
                  <Box width={12}><Text dimColor>Config</Text></Box>
                  <Text color="gray">{server.configName}</Text>
                </Box>
              )}
            </Box>
          ) : (
            <Text dimColor>Launch a model from My Models to start</Text>
          )}
        </Box>

        {/* System Resources Panel */}
        <Box borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
          <Text bold dimColor>System Resources</Text>
          {stats ? (
            <Box flexDirection="column" gap={0}>
              <Box gap={1}>
                <Box width={6}><Text dimColor>CPU</Text></Box>
                <Text color={stats.cpuPercent > 80 ? 'red' : stats.cpuPercent > 50 ? 'yellow' : 'green'}>
                  {stats.cpuPercent}%
                </Text>
              </Box>
              <Box gap={1}>
                <Box width={6}><Text dimColor>RAM</Text></Box>
                <Text>{formatGb(stats.ramUsedBytes)} / {formatGb(stats.ramTotalBytes)}</Text>
              </Box>
              <Box gap={1}>
                <Box width={6}><Text dimColor>VRAM</Text></Box>
                <Text color="gray">{stats.vramLabel}</Text>
              </Box>
            </Box>
          ) : (
            <Text dimColor>Loading…</Text>
          )}
        </Box>

        {/* Recent logs — only when server has logs */}
        {server.logs.length > 0 && (
          <Box borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1} flexGrow={1}>
            <Text bold dimColor>Recent Logs</Text>
            <Box flexDirection="column" overflow="hidden">
              {recentLogs.map((line, i) => (
                <Text key={i} color="gray" wrap="truncate">{line.trim()}</Text>
              ))}
            </Box>
            {server.running && (
              <Text dimColor>[m] open monitor</Text>
            )}
          </Box>
        )}
      </Box>

      {/* Right column — quick actions */}
      <Box flexDirection="column" width="50%">
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
          <Text bold color="cyan">Quick Actions</Text>
          <Box flexDirection="column" marginTop={1}>
            {ACTIONS.map((action, i) => (
              <Box key={action.key} gap={1}>
                <Text color={i === selectedIndex ? 'cyan' : 'gray'}>
                  {i === selectedIndex ? '❯' : ' '}
                </Text>
                <Text bold color="yellow">[{action.shortcut}]</Text>
                <Text color={i === selectedIndex ? 'cyan' : 'white'}>{action.label}</Text>
              </Box>
            ))}
            {server.running && (
              <Box gap={1} marginTop={1}>
                <Text color="gray"> </Text>
                <Text bold color="yellow">[m]</Text>
                <Text color="green">Monitor Server</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
