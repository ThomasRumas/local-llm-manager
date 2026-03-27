import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusBadge } from '../components/status-badge.js';
import { llamaService } from '../modules/llama/llama.service.js';
import { useAsync } from '../hooks/use-async.js';
import type { LlamaStatus } from '../modules/llama/llama.types.js';

interface InstallCheckProps {
  onBack: () => void;
}

export function InstallCheck({ onBack }: InstallCheckProps) {
  const [installing, setInstalling] = useState(false);
  const [installOutput, setInstallOutput] = useState<string[]>([]);
  const [installResult, setInstallResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const {
    data: status,
    loading,
    error,
    retry,
  } = useAsync<LlamaStatus>(() => llamaService.detect(), []);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    setInstallOutput([]);
    const result = await llamaService.install((data) => {
      setInstallOutput((prev) => [...prev, data]);
    });
    setInstallResult(result);
    setInstalling(false);
    if (result.success) {
      retry();
    }
  }, [retry]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    } else if (input === 'i' && status && !status.installed && !installing) {
      handleInstall();
    } else if (input === 'r') {
      retry();
    }
  });

  return (
    <Box flexDirection="column">
      {loading && (
        <StatusBadge status="loading" label="Detecting llama-server..." />
      )}

      {error && <StatusBadge status="error" label={`Error: ${error}`} />}

      {status && !loading && (
        <Box flexDirection="column">
          {status.installed ? (
            <Box flexDirection="column">
              <StatusBadge status="success" label="llama-server is installed" />
              {status.path && <Text color="gray"> Path: {status.path}</Text>}
              {status.version && (
                <Text color="gray"> Version: {status.version}</Text>
              )}
            </Box>
          ) : (
            <Box flexDirection="column">
              <StatusBadge status="warning" label="llama-server not found" />
              {!installing && !installResult && (
                <Text color="gray"> Press {`'i'`} to install via Homebrew</Text>
              )}
            </Box>
          )}
        </Box>
      )}

      {installing && (
        <Box flexDirection="column" marginTop={1}>
          <StatusBadge
            status="loading"
            label="Installing llama.cpp via Homebrew..."
          />
          {installOutput.map((line, i) => (
            <Text key={i} color="gray">
              {line.trimEnd()}
            </Text>
          ))}
        </Box>
      )}

      {installResult && !installing && (
        <Box marginTop={1}>
          {installResult.success ? (
            <StatusBadge status="success" label="Installation complete!" />
          ) : (
            <StatusBadge
              status="error"
              label={`Installation failed: ${installResult.error}`}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
