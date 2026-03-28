import type React from 'react';
import { useState, useCallback } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { StatusBadge } from '../components/status-badge.js';
import { configService } from '../modules/config/config.service.js';
import { apiServer } from '../modules/api/api.server.js';

interface SettingsProps {
  onBack: () => void;
}

type SettingsField =
  | 'modelsDir'
  | 'port'
  | 'ctxSize'
  | 'host'
  | 'hfToken'
  | 'apiEnabled'
  | 'apiPort';
const SETTINGS_FIELDS: SettingsField[] = [
  'modelsDir',
  'port',
  'ctxSize',
  'host',
  'hfToken',
  'apiEnabled',
  'apiPort',
];

type TextSetter = React.Dispatch<React.SetStateAction<string>>;
type BoolSetter = React.Dispatch<React.SetStateAction<boolean>>;
type SavedSetter = React.Dispatch<React.SetStateAction<boolean>>;

interface FieldSetters {
  setModelsDir: TextSetter;
  setPortStr: TextSetter;
  setCtxSizeStr: TextSetter;
  setHost: TextSetter;
  setHfToken: TextSetter;
  setApiEnabled: BoolSetter;
  setApiPortStr: TextSetter;
  setSaved: SavedSetter;
}

function editText(
  setter: TextSetter,
  input: string,
  key: Key,
  isTextKey: boolean,
  digitOnly = false,
): boolean {
  if (key.backspace || key.delete) {
    setter((p) => p.slice(0, -1));
    return true;
  }
  if (isTextKey && (!digitOnly || /^\d$/.test(input))) {
    setter((p) => p + input);
    return true;
  }
  return false;
}

function handleFieldKey(
  field: SettingsField,
  input: string,
  key: Key,
  isTextKey: boolean,
  s: FieldSetters,
): void {
  let changed = false;
  switch (field) {
    case 'modelsDir':
      changed = editText(s.setModelsDir, input, key, isTextKey);
      break;
    case 'port':
      changed = editText(s.setPortStr, input, key, isTextKey, true);
      break;
    case 'ctxSize':
      changed = editText(s.setCtxSizeStr, input, key, isTextKey, true);
      break;
    case 'host':
      changed = editText(s.setHost, input, key, isTextKey);
      break;
    case 'hfToken':
      changed = editText(s.setHfToken, input, key, isTextKey);
      break;
    case 'apiEnabled':
      if (key.leftArrow || key.rightArrow) {
        s.setApiEnabled((p) => !p);
        changed = true;
      }
      break;
    case 'apiPort':
      changed = editText(s.setApiPortStr, input, key, isTextKey, true);
      break;
  }
  if (changed) s.setSaved(false);
}

interface SaveParams {
  modelsDir: string;
  portStr: string;
  ctxSizeStr: string;
  host: string;
  hfToken: string;
  apiEnabled: boolean;
  apiPortStr: string;
}

async function applySave(
  p: Readonly<SaveParams>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setSaved: React.Dispatch<React.SetStateAction<boolean>>,
): Promise<void> {
  const portNum = Number.parseInt(p.portStr, 10);
  const ctxSizeNum = Number.parseInt(p.ctxSizeStr, 10);
  const apiPortNum = Number.parseInt(p.apiPortStr, 10);
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    setError('Port must be a number between 1 and 65535');
    return;
  }
  if (Number.isNaN(ctxSizeNum) || ctxSizeNum < 512) {
    setError('Context size must be a number ≥ 512');
    return;
  }
  if (!p.host.trim()) {
    setError('Host must not be empty');
    return;
  }
  if (Number.isNaN(apiPortNum) || apiPortNum < 1 || apiPortNum > 65535) {
    setError('API port must be a number between 1 and 65535');
    return;
  }
  try {
    await configService.setModelsDirectory(p.modelsDir);
    await configService.setDefaults({
      port: portNum,
      ctxSize: ctxSizeNum,
      host: p.host.trim(),
    });
    await configService.setHfToken(p.hfToken.trim());
    await configService.setApiServerConfig({
      enabled: p.apiEnabled,
      port: apiPortNum,
    });
    if (p.apiEnabled && !apiServer.isRunning) {
      await apiServer.start(apiPortNum);
    } else if (!p.apiEnabled && apiServer.isRunning) {
      await apiServer.stop();
    }
    setSaved(true);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  }
}

export function Settings({ onBack }: Readonly<SettingsProps>) {
  const appConfig = configService.get();
  const [modelsDir, setModelsDir] = useState(appConfig.modelsDirectory);
  const [portStr, setPortStr] = useState(String(appConfig.defaults.port));
  const [ctxSizeStr, setCtxSizeStr] = useState(
    String(appConfig.defaults.ctxSize),
  );
  const [host, setHost] = useState(appConfig.defaults.host ?? '0.0.0.0');
  const [hfToken, setHfToken] = useState(appConfig.hfToken ?? '');
  const [apiEnabled, setApiEnabled] = useState(appConfig.apiServer.enabled);
  const [apiPortStr, setApiPortStr] = useState(
    String(appConfig.apiServer.port),
  );
  const [focusIndex, setFocusIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hfTokenMasked =
    hfToken.length > 0
      ? `hf_${'*'.repeat(Math.max(0, hfToken.length - 3))}${hfToken.slice(-3)}`
      : '(not set)';

  const handleSave = useCallback(() => {
    applySave(
      { modelsDir, portStr, ctxSizeStr, host, hfToken, apiEnabled, apiPortStr },
      setError,
      setSaved,
    );
  }, [modelsDir, portStr, ctxSizeStr, host, hfToken, apiEnabled, apiPortStr]);

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

    const isTextKey =
      !key.ctrl &&
      !key.meta &&
      !key.upArrow &&
      !key.downArrow &&
      !key.return &&
      !key.tab &&
      !key.escape;
    const field = SETTINGS_FIELDS[focusIndex];
    if (field) {
      handleFieldKey(field, input, key, isTextKey, {
        setModelsDir,
        setPortStr,
        setCtxSizeStr,
        setHost,
        setHfToken,
        setApiEnabled,
        setApiPortStr,
        setSaved,
      });
    }

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
          <Text color={focusIndex === 0 ? 'cyan' : 'white'}>
            Models Directory:{' '}
          </Text>
          <Text color={focusIndex === 0 ? 'white' : 'gray'}>{modelsDir}</Text>
          {focusIndex === 0 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 1 ? 'cyan' : 'white'}>
            Default Port:{' '}
          </Text>
          <Text color={focusIndex === 1 ? 'white' : 'gray'}>{portStr}</Text>
          {focusIndex === 1 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 2 ? 'cyan' : 'white'}>
            Default Context Size:{' '}
          </Text>
          <Text color={focusIndex === 2 ? 'white' : 'gray'}>{ctxSizeStr}</Text>
          {focusIndex === 2 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 3 ? 'cyan' : 'white'}>
            Default Host:{' '}
          </Text>
          <Text color={focusIndex === 3 ? 'white' : 'gray'}>{host}</Text>
          {focusIndex === 3 && <Text color="cyan">▎</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 4 ? 'cyan' : 'white'}>
            Hugging Face Token:{' '}
          </Text>
          {focusIndex === 4 ? (
            <Text color="white">{hfToken}</Text>
          ) : (
            <Text color="gray">{hfTokenMasked}</Text>
          )}
          {focusIndex === 4 && <Text color="cyan">▎</Text>}
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>
          ── API Server ─────────────────────
        </Text>
        <Box>
          <Text color={focusIndex === 5 ? 'cyan' : 'white'}>API Server: </Text>
          <Text color={apiEnabled ? 'green' : 'gray'}>
            {apiEnabled ? 'enabled' : 'disabled'}
          </Text>
          {focusIndex === 5 && <Text color="cyan"> ← →</Text>}
          {apiServer.isRunning && <Text color="green"> ● running</Text>}
        </Box>
        <Box>
          <Text color={focusIndex === 6 ? 'cyan' : 'white'}>API Port: </Text>
          <Text color={focusIndex === 6 ? 'white' : 'gray'}>{apiPortStr}</Text>
          {focusIndex === 6 && <Text color="cyan">▎</Text>}
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
