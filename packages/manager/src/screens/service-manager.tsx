import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusBadge } from '../components/status-badge.js';
import { useServiceStatusContext } from '../contexts/service-status-context.js';
import {
  installService,
  uninstallService,
  startService,
  stopService,
} from '../modules/daemon/service.js';

interface ServiceManagerProps {
  onBack: () => void;
}

type Action = 'install' | 'uninstall' | 'start' | 'stop' | null;

export function ServiceManager({ onBack }: Readonly<ServiceManagerProps>) {
  const { installed, running, pid, loading, error, refresh } =
    useServiceStatusContext();
  const [busy, setBusy] = useState<Action>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const run = useCallback(
    async (action: Action, fn: () => Promise<void>, msg: string) => {
      setBusy(action);
      setActionError(null);
      setActionMessage(null);
      try {
        await fn();
        setActionMessage(msg);
        refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return || _input === 'r') {
      refresh();
      return;
    }
    if (busy) return;

    if (_input === 'i') {
      if (!installed) {
        run('install', installService, 'Service installed successfully.');
      }
    } else if (_input === 'u') {
      if (installed) {
        run('uninstall', uninstallService, 'Service uninstalled.');
      }
    } else if (_input === 's') {
      if (installed && !running) {
        run('start', startService, 'Service started.');
      } else if (installed && running) {
        run('stop', stopService, 'Service stopped.');
      }
    }
  });

  const statusLabel = loading
    ? 'Checking...'
    : !installed
      ? 'Not installed'
      : running
        ? `Running${pid !== undefined ? ` (PID ${pid})` : ''}`
        : 'Stopped';

  const statusBadgeStatus = loading
    ? 'loading'
    : !installed
      ? 'warning'
      : running
        ? 'success'
        : 'error';

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        Daemon Service
      </Text>

      {/* Status */}
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="gray">
          Status
        </Text>
        <StatusBadge status={statusBadgeStatus} label={statusLabel} />
        {error !== null ? <Text color="red">{error}</Text> : null}
      </Box>

      {/* Available actions */}
      {!loading && (
        <Box
          borderStyle="round"
          borderColor="gray"
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color="gray">
            Actions
          </Text>

          {!installed && (
            <Text>
              <Text color="cyan">[i]</Text>
              <Text> Install service (start at login)</Text>
            </Text>
          )}

          {installed && !running && (
            <Box flexDirection="column">
              <Text>
                <Text color="cyan">[s]</Text>
                <Text> Start service</Text>
              </Text>
              <Text>
                <Text color="cyan">[u]</Text>
                <Text> Uninstall service</Text>
              </Text>
            </Box>
          )}

          {installed && running && (
            <Box flexDirection="column">
              <Text>
                <Text color="cyan">[s]</Text>
                <Text> Stop service</Text>
              </Text>
              <Text>
                <Text color="cyan">[u]</Text>
                <Text> Uninstall service</Text>
              </Text>
            </Box>
          )}

          <Text>
            <Text color="cyan">[r]</Text>
            <Text> Refresh status</Text>
          </Text>
        </Box>
      )}

      {/* Busy state */}
      {busy !== null ? (
        <StatusBadge
          status="loading"
          label={
            busy === 'install'
              ? 'Installing service...'
              : busy === 'uninstall'
                ? 'Uninstalling service...'
                : busy === 'start'
                  ? 'Starting service...'
                  : 'Stopping service...'
          }
        />
      ) : null}

      {/* Result messages */}
      {actionMessage !== null && busy === null ? (
        <StatusBadge status="success" label={actionMessage} />
      ) : null}
      {actionError !== null && busy === null ? (
        <StatusBadge status="error" label={actionError} />
      ) : null}

      <Text color="gray" dimColor>
        Press Esc to go back
      </Text>
    </Box>
  );
}
