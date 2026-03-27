import React, { useReducer, useCallback, useMemo } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
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

type State = {
  subStep: 'list' | 'actions';
  selectedIdx: number;
  actionIdx: number;
  deleting: boolean;
  deleteError: string | null;
};

type Action =
  | { type: 'LIST_UP' }
  | { type: 'LIST_DOWN'; max: number }
  | { type: 'ENTER_ACTIONS' }
  | { type: 'ACTION_UP' }
  | { type: 'ACTION_DOWN' }
  | { type: 'BACK_TO_LIST' }
  | { type: 'DELETE_START' }
  | { type: 'DELETE_SUCCESS' }
  | { type: 'DELETE_ERROR'; error: string };

const initialState: State = { subStep: 'list', selectedIdx: 0, actionIdx: 0, deleting: false, deleteError: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LIST_UP': return { ...state, selectedIdx: Math.max(0, state.selectedIdx - 1) };
    case 'LIST_DOWN': return { ...state, selectedIdx: Math.min(action.max, state.selectedIdx + 1) };
    case 'ENTER_ACTIONS': return { ...state, subStep: 'actions', actionIdx: 0 };
    case 'ACTION_UP': return { ...state, actionIdx: Math.max(0, state.actionIdx - 1) };
    case 'ACTION_DOWN': return { ...state, actionIdx: Math.min(ACTION_LABELS.length - 1, state.actionIdx + 1) };
    case 'BACK_TO_LIST': return { ...state, subStep: 'list' };
    case 'DELETE_START': return { ...state, deleting: true, deleteError: null };
    case 'DELETE_SUCCESS': return { ...state, subStep: 'list', selectedIdx: Math.max(0, state.selectedIdx - 1), deleting: false };
    case 'DELETE_ERROR': return { ...state, deleteError: action.error, deleting: false };
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}G`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}M`;
  return `${(bytes / 1e3).toFixed(1)}K`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function actionTextColor(active: boolean, label: string): string {
  if (active) return 'cyan';
  return label === 'Delete' ? 'red' : 'white';
}

function handleListKey(key: Key, models: LocalModel[] | null | undefined, dispatch: React.Dispatch<Action>): void {
  if (key.upArrow) dispatch({ type: 'LIST_UP' });
  if (key.downArrow) dispatch({ type: 'LIST_DOWN', max: (models?.length ?? 1) - 1 });
  if (key.return && models && models.length > 0) dispatch({ type: 'ENTER_ACTIONS' });
}

function handleActionsKey(key: Key, actionIdx: number, handleAction: (idx: number) => void, dispatch: React.Dispatch<Action>): void {
  if (key.upArrow) dispatch({ type: 'ACTION_UP' });
  if (key.downArrow) dispatch({ type: 'ACTION_DOWN' });
  if (key.return) handleAction(actionIdx);
}

export function MyModels({ onBack, onNavigate }: Readonly<MyModelsProps>) {
  const server = useServer();
  const [state, dispatch] = useReducer(reducer, initialState);

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
      name: configService.getModelDisplayName(m.filename),
      size: formatSize(m.sizeBytes),
      modified: formatDate(m.lastModified),
      config: m.hasConfig ? '✔' : '—',
    })),
    [modelsWithConfig],
  );

  const selectedModel = modelsWithConfig[state.selectedIdx] ?? null;

  useInput((_input, key) => {
    if (key.escape) {
      if (state.subStep === 'actions') { dispatch({ type: 'BACK_TO_LIST' }); return; }
      onBack();
      return;
    }
    if (state.subStep === 'list') {
      handleListKey(key, models, dispatch);
    } else {
      handleActionsKey(key, state.actionIdx, handleAction, dispatch);
    }
  });

  const handleAction = useCallback(async (idx: number) => {
    if (!selectedModel) return;
    switch (idx) {
      case 0: { // Launch — go directly to model-launch if config already saved
        const savedConfigs = configService.getModelConfigNames(selectedModel.filename);
        if (savedConfigs.length > 0) {
          const configName = savedConfigs[0];
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
        dispatch({ type: 'DELETE_START' });
        try {
          await modelsService.deleteModel(selectedModel.path);
          await configService.deleteModelConfig(selectedModel.filename);
          dispatch({ type: 'DELETE_SUCCESS' });
          retry();
        } catch (err) {
          dispatch({ type: 'DELETE_ERROR', error: err instanceof Error ? err.message : String(err) });
        }
        break;
      case 3: // Back
        dispatch({ type: 'BACK_TO_LIST' });
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
              <Table columns={MODEL_COLUMNS} rows={tableRows} selectedIndex={state.selectedIdx} />
            )}
          </Box>

          {/* Action panel — shown when a model is selected in subStep=actions */}
          {state.subStep === 'actions' && selectedModel && (
            <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1} width={22}>
              <Text bold color="cyan">{selectedModel.filename.replace(/\.gguf$/, '').slice(0, 18)}</Text>
              <Text color="gray">{formatSize(selectedModel.sizeBytes)}</Text>
              <Box flexDirection="column" marginTop={1}>
                {state.deleting ? (
                  <StatusBadge status="loading" label="Deleting…" />
                ) : (
                  ACTION_LABELS.map((label, i) => (
                    <Box key={label} gap={1}>
                      <Text color={i === state.actionIdx ? 'cyan' : 'gray'}>{i === state.actionIdx ? '❯' : ' '}</Text>
                      <Text color={actionTextColor(i === state.actionIdx, label)}>{label}</Text>
                    </Box>
                  ))
                )}
              </Box>
              {state.deleteError && <Text color="red">{state.deleteError}</Text>}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
