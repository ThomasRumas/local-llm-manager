import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useServer } from '../contexts/server-context.js';
import { configService } from '../modules/config/config.service.js';
import { useSystemStats } from '../hooks/use-system-stats.js';

interface ModelLaunchProps {
  modelFile?: string;
  configName?: string;
  onBack: () => void;
}

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

export function ModelLaunch({
  modelFile,
  configName = 'default',
  onBack,
}: Readonly<ModelLaunchProps>) {
  const server = useServer();
  const [scrollOffset, setScrollOffset] = useState(0);
  const stats = useSystemStats(server.pid);

  // Start the server only if not already running for this model.
  // model-config already calls server.start() before navigating here,
  // so we only start directly when arriving without that prior call.
  useEffect(() => {
    if (!modelFile) return;
    if (server.running && server.modelFile === modelFile) return;
    const modelsDir = configService.getModelsDirectory();
    const modelPath = `${modelsDir}/${modelFile}`;
    const resolved = configService.getEffective(
      modelFile,
      modelPath,
      configName,
    );
    server.start(resolved, modelFile, configName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const VISIBLE_LINES = 20;

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.downArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.upArrow) {
      const maxOffset = Math.max(0, server.logs.length - VISIBLE_LINES);
      setScrollOffset((prev) => Math.min(maxOffset, prev + 1));
    }
    if (_input === 's') {
      server.stop();
    }
  });

  const totalLogs = server.logs.length;
  const visibleLogs = server.logs.slice(
    Math.max(0, totalLogs - VISIBLE_LINES - scrollOffset),
    totalLogs - scrollOffset || undefined,
  );

  return (
    <Box flexDirection="row" gap={2} height="100%">
      {/* Info panel */}
      <Box
        borderStyle="round"
        borderColor={server.running ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
        width={32}
      >
        <Text bold color={server.running ? 'green' : 'gray'}>
          {server.running ? '● Running' : '○ Stopped'}
        </Text>
        <Box flexDirection="column" marginTop={1} gap={0}>
          <InfoRow
            label="Model"
            value={
              server.modelFile
                ? configService.getModelDisplayName(
                    server.modelFile,
                    server.configName ?? 'default',
                  )
                : '—'
            }
          />
          <InfoRow label="Config" value={server.configName ?? '—'} />
          <InfoRow
            label="Port"
            value={server.port ? `:${server.port}` : '—'}
            color="cyan"
          />
          <InfoRow
            label="Uptime"
            value={formatUptime(server.uptimeSeconds)}
            color={server.running ? 'green' : 'gray'}
          />
          {server.pid && <InfoRow label="PID" value={String(server.pid)} />}
        </Box>

        {/* System resources */}
        <Box marginTop={1} flexDirection="column" gap={0}>
          <Text bold dimColor>
            System
          </Text>
          {stats ? (
            <>
              <InfoRow
                label="CPU"
                value={`${stats.cpuPercent}%`}
                color={stats.cpuPercent > 80 ? 'red' : 'green'}
              />
              <InfoRow
                label="RAM"
                value={`${formatGb(stats.ramUsedBytes)} / ${formatGb(stats.ramTotalBytes)}`}
              />
              <InfoRow label="VRAM" value={stats.vramLabel} color="gray" />
              {stats.processCpuPercent !== null && (
                <InfoRow
                  label="Proc CPU"
                  value={`${stats.processCpuPercent.toFixed(1)}%`}
                  color="cyan"
                />
              )}
              {stats.processRamBytes !== null && (
                <InfoRow
                  label="Proc RAM"
                  value={formatGb(stats.processRamBytes)}
                  color="cyan"
                />
              )}
            </>
          ) : (
            <Text dimColor>Loading…</Text>
          )}
        </Box>
        {server.running && (
          <Box marginTop={1}>
            <Text color="cyan" dimColor>
              http://localhost:{server.port}
            </Text>
          </Box>
        )}
        {server.error && (
          <Box marginTop={1}>
            <Text color="red" wrap="wrap">
              {server.error}
            </Text>
          </Box>
        )}
      </Box>

      {/* Logs panel */}
      <Box
        borderStyle="single"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
        flexGrow={1}
        overflow="hidden"
      >
        <Box justifyContent="space-between">
          <Text bold dimColor>
            Logs
          </Text>
          <Text dimColor>
            {totalLogs} lines{scrollOffset > 0 ? `  ↑ +${scrollOffset}` : ''}
          </Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {visibleLogs.map((line, i) => {
            const isError =
              line.includes('[error]') ||
              line.includes('ERROR') ||
              line.includes('error');
            const isInfo = line.includes('[info]') || line.includes('INFO');
            let lineColor = 'gray';
            if (isError) lineColor = 'red';
            else if (isInfo) lineColor = 'cyan';
            return (
              <Text
                key={Math.max(0, totalLogs - VISIBLE_LINES - scrollOffset) + i}
                color={lineColor}
                wrap="truncate"
              >
                {line.trim()}
              </Text>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function InfoRow({
  label,
  value,
  color,
}: Readonly<{ label: string; value: string; color?: string }>) {
  return (
    <Box gap={1}>
      <Box width={8}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text color={color ?? 'white'} wrap="truncate">
        {value}
      </Text>
    </Box>
  );
}
