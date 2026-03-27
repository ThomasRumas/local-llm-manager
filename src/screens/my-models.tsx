import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table, type TableColumn } from '../components/table.js';
import { StatusBadge } from '../components/status-badge.js';
import { modelsService } from '../modules/models/models.service.js';
import { configService } from '../modules/config/config.service.js';
import { useServer } from '../contexts/server-context.js';
import { useAsync } from '../hooks/use-async.js';
import type { LocalModel } from '../modules/models/models.types.js';
import type { Screen, ScreenParams } from '../hooks/use-screen.js';

interface MyModelsProps {
  onBack: () => void;
  onNavigate: (screen: Screen, params?: ScreenParams) => void;
}

const MODEL_COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Model', width: 36 },
  { key: 'size', label: 'Size', width: 8, align: 'right' },
  { key: 'modified', label: 'Modified', width: 12 },
  { key: 'config', label: 'Config', width: 7 },
];

const ACTION_LABELS = ['Launch', 'Configure', 'Delete', '← Back'];

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}G`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}M`;
  return `${(bytes / 1e3).toFixed(1)}K`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export function MyModels({ onBack, onNavigate }: MyModelsProps) {
  const server = useServer();
  const [subStep, setSubStep] = useState<'list' | 'actions'>('list');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [actionIdx, setActionIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const modelsDir = configService.getModelsDirectory();
  const { data: models, loading, error, retry } = useAsync<LocalModel[]>(
    () => modelsService.listLocal(modelsDir),
    [modelsDir],
  );

  const modelsWithConfig = useMemo(
    () => (models ?? []).map((m) => ({
      ...m,
      hasConfig: configService.getModelConfigNames(m.filename).length > 0,
    })),
    [models],
  );

  const tableRows = useMemo(
    () => modelsWithConfig.map((m) => ({
      name: m.filename.replace(/\.gguf$/, ''),
      size: formatSize(m.sizeBytes),
      modified: formatDate(m.lastModified),
      config: m.hasConfig ? '✔' : '—',
    })),
    [modelsWithConfig],
  );

  const selectedModel = modelsWithConfig[selectedIdx] ?? null;

  useInput((_input, key) => {
    if (key.escape) {
      if (subStep === 'actions') { setSubStep('list'); return; }
      onBack();
      return;
    }

    if (subStep === 'list') {
      if (key.upArrow) setSelectedIdx((p) => Math.max(0, p - 1));
      if (key.downArrow) setSelectedIdx((p) => Math.min((models?.length ?? 1) - 1, p + 1));
      if (key.return && models && models.length > 0) {
        setActionIdx(0);
        setSubStep('actions');
      }
    } else {
      if (key.upArrow) setActionIdx((p) => Math.max(0, p - 1));
      if (key.downArrow) setActionIdx((p) => Math.min(ACTION_LABELS.length - 1, p + 1));
      if (key.return) handleAction(actionIdx);
    }
  });

  const handleAction = useCallback(async (idx: number) => {
    if (!selectedModel) return;
    switch (idx) {
      case 0: { // Launch — go directly to model-launch if config already saved
        const savedConfigs = configService.getModelConfigNames(selectedModel.filename);
        if (savedConfigs.length > 0) {
          const configName = savedConfigs[0]!;
          const dir = configService.getModelsDirectory();
          const modelPath = `${dir}/${selectedModel.filename}`;
          const resolved = configService.getEffective(selectedModel.filename, modelPath, configName);
          server.start(resolved, selectedModel.filename, configName);
          onNavigate('model-launch', { modelFile: selectedModel.filename, configName });
        } else {
          onNavigate('model-config', { modelFile: selectedModel.filename });
        }
        break;
      }
      case 1: // Configure
        onNavigate('model-config', { modelFile: selectedModel.filename });
        break;
      case 2: // Delete
        setDeleting(true);
        setDeleteError(null);
        try {
          await modelsService.deleteModel(selectedModel.path);
          await configService.deleteModelConfig(selectedModel.filename);
          setSubStep('list');
          setSelectedIdx((p) => Math.max(0, p - 1));
          retry();
        } catch (err) {
          setDeleteError(err instanceof Error ? err.message : String(err));
        } finally {
          setDeleting(false);
        }
        break;
      case 3: // Back
        setSubStep('list');
        break;
    }
  }, [selectedModel, onNavigate, retry]);

  return (
    <Box flexDirection="column" gap={1} height="100%">
      {loading && <StatusBadge status="loading" label="Scanning models directory…" />}
      {error && <StatusBadge status="error" label={error} />}

      {!loading && models && (
        <Box flexDirection="row" gap={2} height="100%">
          {/* Model table */}
          <Box borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1} flexGrow={1}>
            <Text bold dimColor>MY MODELS  <Text color="gray">({modelsDir})</Text></Text>
            {models.length === 0 ? (
              <Text color="yellow">No .gguf files found in {modelsDir}</Text>
            ) : (
              <Table columns={MODEL_COLUMNS} rows={tableRows} selectedIndex={selectedIdx} />
            )}
          </Box>

          {/* Action panel — shown when a model is selected in subStep=actions */}
          {subStep === 'actions' && selectedModel && (
            <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1} width={22}>
              <Text bold color="cyan">{selectedModel.filename.replace(/\.gguf$/, '').slice(0, 18)}</Text>
              <Text color="gray">{formatSize(selectedModel.sizeBytes)}</Text>
              <Box flexDirection="column" marginTop={1}>
                {deleting ? (
                  <StatusBadge status="loading" label="Deleting…" />
                ) : (
                  ACTION_LABELS.map((label, i) => (
                    <Box key={label} gap={1}>
                      <Text color={i === actionIdx ? 'cyan' : 'gray'}>{i === actionIdx ? '❯' : ' '}</Text>
                      <Text color={i === actionIdx ? 'cyan' : (label === 'Delete' ? 'red' : 'white')}>{label}</Text>
                    </Box>
                  ))
                )}
              </Box>
              {deleteError && <Text color="red">{deleteError}</Text>}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
