import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusBadge } from '../components/status-badge.js';
import { configService } from '../modules/config/config.service.js';

interface SettingsProps {
  onBack: () => void;
}

type SettingsField = 'modelsDir' | 'port' | 'ctxSize' | 'hfToken';
const SETTINGS_FIELDS: SettingsField[] = ['modelsDir', 'port', 'ctxSize', 'hfToken'];

export function Settings({ onBack }: SettingsProps) {
  const appConfig = configService.get();
  const [modelsDir, setModelsDir] = useState(appConfig.modelsDirectory);
  const [portStr, setPortStr] = useState(String(appConfig.defaults.port));
  const [ctxSizeStr, setCtxSizeStr] = useState(String(appConfig.defaults.ctxSize));
  const [hfToken, setHfToken] = useState(appConfig.hfToken ?? '');
  const [focusIndex, setFocusIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const portNum = parseInt(portStr, 10);
    const ctxSizeNum = parseInt(ctxSizeStr, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Port must be a number between 1 and 65535');
      return;
    }
    if (isNaN(ctxSizeNum) || ctxSizeNum < 512) {
      setError('Context size must be a number ≥ 512');
      return;
    }
    try {
      await configService.setModelsDirectory(modelsDir);
      await configService.setDefaults({ port: portNum, ctxSize: ctxSizeNum });
      await configService.setHfToken(hfToken.trim());
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [modelsDir, portStr, ctxSizeStr, hfToken]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      setFocusIndex((prev) => (prev > 0 ? prev - 1 : SETTINGS_FIELDS.length));
    } else if (key.downArrow || key.tab) {
      setFocusIndex((prev) => (prev < SETTINGS_FIELDS.length ? prev + 1 : 0));
    }

    const isTextKey = !key.ctrl && !key.meta && !key.upArrow && !key.downArrow && !key.return && !key.tab && !key.escape;

    const field = SETTINGS_FIELDS[focusIndex];
    if (field === 'modelsDir') {
      if (key.backspace || key.delete) {
        setModelsDir((prev) => prev.slice(0, -1));
        setSaved(false);
      } else if (isTextKey) {
        setModelsDir((prev) => prev + input);
        setSaved(false);
      }
    } else if (field === 'port') {
      if (key.backspace || key.delete) {
        setPortStr((prev) => prev.slice(0, -1));
        setSaved(false);
      } else if (isTextKey && /^\d$/.test(input)) {
        setPortStr((prev) => prev + input);
        setSaved(false);
      }
    } else if (field === 'ctxSize') {
      if (key.backspace || key.delete) {
        setCtxSizeStr((prev) => prev.slice(0, -1));
        setSaved(false);
      } else if (isTextKey && /^\d$/.test(input)) {
        setCtxSizeStr((prev) => prev + input);
        setSaved(false);
      }
    } else if (field === 'hfToken') {
      if (key.backspace || key.delete) {
        setHfToken((prev) => prev.slice(0, -1));
        setSaved(false);
      } else if (isTextKey) {
        setHfToken((prev) => prev + input);
        setSaved(false);
      }
    }

    // Save button
    if (focusIndex === SETTINGS_FIELDS.length && key.return) {
      handleSave();
    }

    if (key.ctrl && input === 's') {
      handleSave();
    }
  });

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        <Box>
          <Text color={focusIndex === 0 ? 'cyan' : 'white'}>Models Directory: </Text>
          <Text color={focusIndex === 0 ? 'white' : 'gray'}>{modelsDir}</Text>
          {focusIndex === 0 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 1 ? 'cyan' : 'white'}>Default Port: </Text>
          <Text color={focusIndex === 1 ? 'white' : 'gray'}>{portStr}</Text>
          {focusIndex === 1 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 2 ? 'cyan' : 'white'}>Default Context Size: </Text>
          <Text color={focusIndex === 2 ? 'white' : 'gray'}>{ctxSizeStr}</Text>
          {focusIndex === 2 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 3 ? 'cyan' : 'white'}>Hugging Face Token: </Text>
          {focusIndex === 3 ? (
            <Text color="white">{hfToken}</Text>
          ) : (
            <Text color="gray">
              {hfToken.length > 0 ? `hf_${'*'.repeat(Math.max(0, hfToken.length - 3))}${hfToken.slice(-3)}` : '(not set)'}
            </Text>
          )}
          {focusIndex === 3 && <Text color="cyan">▎</Text>}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={focusIndex === SETTINGS_FIELDS.length ? 'cyan' : 'white'}>
          {'  '}[Enter] Save
        </Text>
      </Box>

      {saved && <StatusBadge status="success" label="Settings saved!" />}
      {error && <StatusBadge status="error" label={error} />}
    </Box>
  );
}
