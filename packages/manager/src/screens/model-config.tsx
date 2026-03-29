import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusBadge } from '../components/status-badge.js';
import { configService } from '../modules/config/config.service.js';
import type { ResolvedConfig } from '../modules/config/config.types.js';
import type { Screen, ScreenParams } from '../hooks/use-screen.js';

interface ModelConfigProps {
  modelFile: string;
  configName?: string;
  onBack: () => void;
  onNavigate: (screen: Screen, params?: ScreenParams) => void;
}

type Field =
  | 'alias'
  | 'temp'
  | 'topP'
  | 'topK'
  | 'minP'
  | 'port'
  | 'ctxSize'
  | 'cacheTypeK'
  | 'cacheTypeV'
  | 'flashAttn'
  | 'fit'
  | 'kvUnified'
  | 'gpuLayers'
  | 'extraFlags';

const FIELDS: Field[] = [
  'alias',
  'temp',
  'topP',
  'topK',
  'minP',
  'port',
  'ctxSize',
  'cacheTypeK',
  'cacheTypeV',
  'flashAttn',
  'fit',
  'kvUnified',
  'gpuLayers',
  'extraFlags',
];

const CACHE_TYPES_BASE = [
  'f16',
  'f32',
  'q8_0',
  'q4_0',
  'q4_1',
  'q5_0',
  'q5_1',
] as const;
const CACHE_TYPES_IK = [...CACHE_TYPES_BASE, 'iq4_nl'] as const;
type CacheTypeItem = (typeof CACHE_TYPES_IK)[number];

export function ModelConfig({
  modelFile,
  configName = 'default',
  onBack,
  onNavigate,
}: ModelConfigProps) {
  const modelsDir = configService.getModelsDirectory();
  const modelPath = `${modelsDir}/${modelFile}`;
  const initial = configService.getEffective(modelFile, modelPath, configName);
  const isIkLlama = configService.get().defaults.isIkLlama ?? false;

  const [config, setConfig] = useState<ResolvedConfig>(initial);
  const [focusIndex, setFocusIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [selectedConfigName, setSelectedConfigName] = useState(configName);
  const [prevConfigName, setPrevConfigName] = useState(selectedConfigName);
  const configNames = configService.getModelConfigNames(modelFile);
  const availableConfigs = configNames.length > 0 ? configNames : ['default'];

  // Reset config synchronously when the selected configuration name changes
  // (reset-during-render avoids the double render caused by useEffect + setState)
  if (prevConfigName !== selectedConfigName) {
    setPrevConfigName(selectedConfigName);
    setConfig(
      configService.getEffective(modelFile, modelPath, selectedConfigName),
    );
  }

  const updateField = useCallback(
    <K extends keyof ResolvedConfig>(field: K, value: ResolvedConfig[K]) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
      setSaved(false);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const { modelPath: _mp, ...rest } = config;
    await configService.saveModelConfig(modelFile, selectedConfigName, rest);
    setSaved(true);
  }, [config, modelFile, selectedConfigName]);

  const handleLaunch = useCallback(async () => {
    await handleSave();
    onNavigate('model-launch', { modelFile, configName: selectedConfigName });
  }, [handleSave, onNavigate, modelFile, selectedConfigName]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      setFocusIndex((prev) => (prev > 0 ? prev - 1 : FIELDS.length + 1));
    } else if (key.downArrow || key.tab) {
      setFocusIndex((prev) => (prev < FIELDS.length + 1 ? prev + 1 : 0));
    }

    // Config name selector at index 0
    if (focusIndex === 0) {
      if (key.leftArrow || key.rightArrow) {
        const idx = availableConfigs.indexOf(selectedConfigName);
        const dir = key.rightArrow ? 1 : -1;
        const next =
          (idx + dir + availableConfigs.length) % availableConfigs.length;
        setSelectedConfigName(availableConfigs[next]!);
      }
    }

    // Save (S) and Launch (L) at bottom
    if (focusIndex === FIELDS.length + 1) {
      if (input === 's') handleSave();
      if (input === 'l') handleLaunch();
    }

    // Global shortcuts
    if (key.ctrl && input === 's') handleSave();
    if (key.ctrl && input === 'l') handleLaunch();
  });

  const isFocused = (idx: number) => focusIndex === idx + 1;

  return (
    <Box flexDirection="column" gap={0}>
      <Box>
        <Text color={focusIndex === 0 ? 'cyan' : 'white'}>Config: </Text>
        <Text color={focusIndex === 0 ? 'white' : 'gray'}>
          {selectedConfigName}
        </Text>
        {focusIndex === 0 && <Text color="gray"> (←/→ to switch)</Text>}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={isFocused(0) ? 'cyan' : 'white'}>Alias: </Text>
          <Text color={isFocused(0) ? 'white' : 'gray'}>{config.alias}</Text>
        </Box>
        <Box>
          <Text color={isFocused(1) ? 'cyan' : 'white'}>Temperature: </Text>
          <Text color={isFocused(1) ? 'white' : 'gray'}>{config.temp}</Text>
          {isFocused(1) && <Text color="gray"> (←/→ ±0.1)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(2) ? 'cyan' : 'white'}>Top-P: </Text>
          <Text color={isFocused(2) ? 'white' : 'gray'}>{config.topP}</Text>
          {isFocused(2) && <Text color="gray"> (←/→ ±0.05)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(3) ? 'cyan' : 'white'}>Top-K: </Text>
          <Text color={isFocused(3) ? 'white' : 'gray'}>{config.topK}</Text>
          {isFocused(3) && <Text color="gray"> (←/→ ±1)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(4) ? 'cyan' : 'white'}>Min-P: </Text>
          <Text color={isFocused(4) ? 'white' : 'gray'}>{config.minP}</Text>
          {isFocused(4) && <Text color="gray"> (←/→ ±0.01)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(5) ? 'cyan' : 'white'}>Port: </Text>
          <Text color={isFocused(5) ? 'white' : 'gray'}>{config.port}</Text>
          {isFocused(5) && <Text color="gray"> (←/→ ±1)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(6) ? 'cyan' : 'white'}>Context Size: </Text>
          <Text color={isFocused(6) ? 'white' : 'gray'}>{config.ctxSize}</Text>
          {isFocused(6) && <Text color="gray"> (←/→ ±1024)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(7) ? 'cyan' : 'white'}>Cache Type K: </Text>
          <Text color={isFocused(7) ? 'white' : 'gray'}>
            {config.cacheTypeK}
          </Text>
          {isFocused(7) && <Text color="gray"> (←/→)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(8) ? 'cyan' : 'white'}>Cache Type V: </Text>
          <Text color={isFocused(8) ? 'white' : 'gray'}>
            {config.cacheTypeV}
          </Text>
          {isFocused(8) && <Text color="gray"> (←/→)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(9) ? 'cyan' : 'white'}>Flash Attention: </Text>
          <Text color={isFocused(9) ? 'white' : 'gray'}>
            {config.flashAttn}
          </Text>
          {isFocused(9) && <Text color="gray"> (←/→)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(10) ? 'cyan' : 'white'}>FIT: </Text>
          <Text color={isFocused(10) ? 'white' : 'gray'}>{config.fit}</Text>
          {isFocused(10) && <Text color="gray"> (←/→)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(11) ? 'cyan' : 'white'}>KV Unified: </Text>
          <Text color={config.kvUnified ? 'green' : 'gray'}>
            {config.kvUnified ? 'on' : 'off'}
          </Text>
          {isFocused(11) && <Text color="gray"> (←/→)</Text>}
          {isIkLlama && <Text color="magenta"> ik</Text>}
        </Box>
        <Box>
          <Text color={isFocused(12) ? 'cyan' : 'white'}>GPU Layers: </Text>
          <Text color={isFocused(12) ? 'white' : 'gray'}>
            {config.gpuLayers}
          </Text>
          {isFocused(12) && <Text color="gray"> (←/→ ±1, shift ±10)</Text>}
        </Box>
        <Box>
          <Text color={isFocused(13) ? 'cyan' : 'white'}>Extra Flags: </Text>
          <Text color={isFocused(13) ? 'white' : 'gray'}>
            {config.extraFlags || '(none)'}
          </Text>
        </Box>
      </Box>

      {/* Handle field editing via input */}
      <FieldEditor
        focusIndex={focusIndex}
        config={config}
        updateField={updateField}
        isIkLlama={isIkLlama}
      />

      <Box marginTop={1}>
        <Text color={focusIndex === FIELDS.length + 1 ? 'cyan' : 'white'}>
          {'  '}[S] Save [L] Save & Launch
        </Text>
      </Box>

      {saved && <StatusBadge status="success" label="Configuration saved!" />}
    </Box>
  );
}

interface FieldEditorProps {
  focusIndex: number;
  config: ResolvedConfig;
  updateField: <K extends keyof ResolvedConfig>(
    field: K,
    value: ResolvedConfig[K],
  ) => void;
  isIkLlama: boolean;
}

function FieldEditor({
  focusIndex,
  config,
  updateField,
  isIkLlama,
}: FieldEditorProps) {
  const fieldIdx = focusIndex - 1;
  const cacheTypes: readonly CacheTypeItem[] = isIkLlama
    ? CACHE_TYPES_IK
    : CACHE_TYPES_BASE;

  useInput((input, key) => {
    if (fieldIdx < 0 || fieldIdx >= FIELDS.length) return;

    const field = FIELDS[fieldIdx]!;

    switch (field) {
      case 'alias':
      case 'extraFlags':
        if (key.backspace || key.delete) {
          updateField(field, (config[field] as string).slice(0, -1));
        } else if (
          !key.ctrl &&
          !key.meta &&
          !key.upArrow &&
          !key.downArrow &&
          !key.return &&
          !key.tab &&
          !key.escape
        ) {
          updateField(field, (config[field] as string) + input);
        }
        break;

      case 'temp':
        if (key.leftArrow)
          updateField('temp', Math.max(0, +(config.temp - 0.1).toFixed(2)));
        if (key.rightArrow)
          updateField('temp', +(config.temp + 0.1).toFixed(2));
        break;
      case 'topP':
        if (key.leftArrow)
          updateField('topP', Math.max(0, +(config.topP - 0.05).toFixed(2)));
        if (key.rightArrow)
          updateField('topP', Math.min(1, +(config.topP + 0.05).toFixed(2)));
        break;
      case 'topK':
        if (key.leftArrow) updateField('topK', Math.max(0, config.topK - 1));
        if (key.rightArrow) updateField('topK', config.topK + 1);
        break;
      case 'minP':
        if (key.leftArrow)
          updateField('minP', Math.max(0, +(config.minP - 0.01).toFixed(3)));
        if (key.rightArrow)
          updateField('minP', Math.min(1, +(config.minP + 0.01).toFixed(3)));
        break;
      case 'port':
        if (key.leftArrow) updateField('port', Math.max(1, config.port - 1));
        if (key.rightArrow)
          updateField('port', Math.min(65535, config.port + 1));
        break;
      case 'ctxSize':
        if (key.leftArrow)
          updateField('ctxSize', Math.max(1024, config.ctxSize - 1024));
        if (key.rightArrow) updateField('ctxSize', config.ctxSize + 1024);
        break;
      case 'cacheTypeK':
      case 'cacheTypeV': {
        const idx = cacheTypes.indexOf(config[field] as CacheTypeItem);
        const safeIdx = idx < 0 ? 0 : idx;
        if (key.leftArrow)
          updateField(
            field,
            cacheTypes[(safeIdx - 1 + cacheTypes.length) % cacheTypes.length]!,
          );
        if (key.rightArrow)
          updateField(field, cacheTypes[(safeIdx + 1) % cacheTypes.length]!);
        break;
      }
      case 'flashAttn':
      case 'fit': {
        if (key.leftArrow || key.rightArrow) {
          updateField(field, config[field] === 'on' ? 'off' : 'on');
        }
        break;
      }
      case 'kvUnified': {
        if (key.leftArrow || key.rightArrow) {
          updateField('kvUnified', !config.kvUnified);
        }
        break;
      }
      case 'gpuLayers': {
        const step = key.shift ? 10 : 1;
        if (key.leftArrow)
          updateField('gpuLayers', Math.max(0, config.gpuLayers - step));
        if (key.rightArrow) updateField('gpuLayers', config.gpuLayers + step);
        break;
      }
    }
  });

  return null;
}
