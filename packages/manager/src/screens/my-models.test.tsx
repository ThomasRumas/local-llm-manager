import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../modules/models/models.service.js', () => ({
  modelsService: {
    listLocal: vi.fn(),
    deleteModel: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../modules/config/config.service.js', () => ({
  configService: {
    getModelsDirectory: vi.fn().mockReturnValue('/models'),
    getModelConfigNames: vi.fn().mockReturnValue([]),
    getModelDisplayName: vi.fn((filename: string) => filename.replace(/\.gguf$/, '')),
    getEffective: vi.fn(),
    deleteModelConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../contexts/server-context.js', () => ({
  useServer: vi.fn().mockReturnValue({
    running: false,
    modelFile: null,
    configName: null,
    port: null,
    pid: null,
    uptimeSeconds: 0,
    logs: [],
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

import { modelsService } from '../modules/models/models.service.js';
import { configService } from '../modules/config/config.service.js';
import { useServer } from '../contexts/server-context.js';
import { MyModels } from './my-models.js';

const mockListLocal = vi.mocked(modelsService.listLocal);
const mockGetModelConfigNames = vi.mocked(configService.getModelConfigNames);
const mockGetModelDisplayName = vi.mocked(configService.getModelDisplayName);

const SAMPLE_MODELS = [
  { filename: 'model-a.gguf', path: '/models/model-a.gguf', sizeBytes: 4_200_000_000, lastModified: new Date('2025-01-01'), hasConfig: false },
  { filename: 'model-b.gguf', path: '/models/model-b.gguf', sizeBytes: 2_100_000_000, lastModified: new Date('2025-06-01'), hasConfig: false },
];

describe('MyModels', () => {
  beforeEach(() => {
    // mockReset clears vi.mock factory defaults — re-apply them each test
    mockGetModelConfigNames.mockReturnValue([]);
    mockGetModelDisplayName.mockImplementation((filename: string) => filename.replace(/\.gguf$/, ''));
    vi.mocked(configService.getModelsDirectory).mockReturnValue('/models');
    vi.mocked(configService.getEffective).mockReturnValue({} as any);
    vi.mocked(configService.deleteModelConfig).mockResolvedValue(undefined);
    vi.mocked(modelsService.deleteModel).mockResolvedValue(undefined);
    vi.mocked(useServer).mockReturnValue({
      running: false, modelFile: null, configName: null, port: null, pid: null,
      uptimeSeconds: 0, logs: [], error: null, start: vi.fn(), stop: vi.fn(),
    } as any);
  });
  it('shows loading state initially', () => {
    mockListLocal.mockReturnValueOnce(new Promise(() => {}));
    const { lastFrame } = render(<MyModels onBack={vi.fn()} onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Scanning');
  });

  it('renders model list when models are found', async () => {
    mockListLocal.mockResolvedValueOnce(SAMPLE_MODELS);
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={vi.fn()} />);
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('model-a');
    });
    expect(instance.lastFrame()).toContain('model-b');
  });

  it('shows "No .gguf files found" when directory is empty', async () => {
    mockListLocal.mockResolvedValueOnce([]);
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={vi.fn()} />);
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('No .gguf files found');
    });
  });

  it('shows actions panel on Enter key', async () => {
    mockListLocal.mockResolvedValueOnce(SAMPLE_MODELS);
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={vi.fn()} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('model-a'));

    instance.stdin.write('\r'); // Enter
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Launch');
      expect(instance.lastFrame()).toContain('Configure');
      expect(instance.lastFrame()).toContain('Delete');
    });
  });

  it('navigates to model-config when Configure is selected', async () => {
    mockListLocal.mockResolvedValueOnce(SAMPLE_MODELS);
    const onNavigate = vi.fn();
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={onNavigate} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('model-a'), { timeout: 3000 });

    instance.stdin.write('\r'); // Enter → actions panel (selectedIdx=0 → model-a)
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Launch'), { timeout: 3000 });
    instance.stdin.write('\x1B[B'); // Down → Configure
    instance.stdin.write('\r');
    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('model-config', { modelFile: 'model-a.gguf' });
    }, { timeout: 3000 });
  });

  it('goes back when Escape is pressed in actions panel', async () => {
    mockListLocal.mockResolvedValueOnce(SAMPLE_MODELS);
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={vi.fn()} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('model-a'), { timeout: 3000 });

    instance.stdin.write('\r');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Launch'), { timeout: 3000 });
    instance.stdin.write('\x1B'); // ESC
    // Should return to list (no actions panel)
    await vi.waitFor(() => {
      expect(instance.lastFrame()).not.toContain('Configure');
    }, { timeout: 3000 });
  });

  it('launches model with saved config directly', async () => {
    mockGetModelConfigNames.mockReturnValue(['default']);
    vi.mocked(configService.getEffective).mockReturnValue({ port: 8001 } as any);
    mockListLocal.mockResolvedValueOnce(SAMPLE_MODELS);
    const onNavigate = vi.fn();
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={onNavigate} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('model-a'), { timeout: 3000 });

    instance.stdin.write('\r'); // Enter → actions panel
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Launch'), { timeout: 3000 });
    // Press down to ensure actionIdx=0 (Launch)
    instance.stdin.write('\r'); // Enter → Launch (actionIdx=0)
    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalled();
    }, { timeout: 3000 });
    expect(onNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/model-launch|model-config/),
      expect.any(Object),
    );
  });

  it('navigates to model-config for launch without config', async () => {
    mockGetModelConfigNames.mockReturnValue([]); // no saved configs
    mockListLocal.mockResolvedValueOnce(SAMPLE_MODELS);
    const onNavigate = vi.fn();
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={onNavigate} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('model-a'), { timeout: 3000 });

    instance.stdin.write('\r'); // Enter → actions panel
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Launch'), { timeout: 3000 });
    instance.stdin.write('\r'); // Enter → Launch (actionIdx=0) — no saved config → model-config
    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('model-config', { modelFile: 'model-a.gguf' });
    }, { timeout: 3000 });
  });

  it('deletes model when Delete action is selected', async () => {
    vi.mocked(modelsService.deleteModel).mockResolvedValue(undefined);
    vi.mocked(configService.deleteModelConfig).mockResolvedValue(undefined);
    mockListLocal.mockResolvedValue(SAMPLE_MODELS);
    const instance = render(<MyModels onBack={vi.fn()} onNavigate={vi.fn()} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('model-a'), { timeout: 3000 });

    instance.stdin.write('\r'); // Enter → show actions panel (actionIdx=0 Launch)
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Launch'), { timeout: 3000 });

    // Navigate to Delete (actionIdx=2) using two Down presses with waitFor between each
    instance.stdin.write('\x1B[B'); // Down → actionIdx=1
    await new Promise((r) => setTimeout(r, 100));
    instance.stdin.write('\x1B[B'); // Down → actionIdx=2 Delete
    await new Promise((r) => setTimeout(r, 100));
    instance.stdin.write('\r'); // Enter → Delete action
    await vi.waitFor(() => {
      expect(vi.mocked(modelsService.deleteModel)).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('calls onBack when Escape is pressed in list view', async () => {
    mockListLocal.mockResolvedValueOnce([]);
    const onBack = vi.fn();
    const instance = render(<MyModels onBack={onBack} onNavigate={vi.fn()} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('No .gguf'), { timeout: 3000 });
    instance.stdin.write('\x1B'); // ESC from list view
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled(), { timeout: 3000 });
  });
});
