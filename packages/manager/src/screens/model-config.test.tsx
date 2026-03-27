import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../modules/config/config.service.js', () => ({
  configService: {
    getModelsDirectory: vi.fn(),
    getEffective: vi.fn(),
    getModelConfigNames: vi.fn(),
    saveModelConfig: vi.fn(),
  },
}));

vi.mock('../contexts/server-context.js', () => ({
  useServer: vi.fn(),
}));

import { configService } from '../modules/config/config.service.js';
import { useServer } from '../contexts/server-context.js';
import { ModelConfig } from './model-config.js';

const DEFAULT_RESOLVED = {
  alias: 'my-model',
  temp: 0.6,
  topP: 0.95,
  topK: 20,
  minP: 0,
  port: 8001,
  ctxSize: 131072,
  kvUnified: true,
  cacheTypeK: 'q8_0' as const,
  cacheTypeV: 'q8_0' as const,
  flashAttn: 'on' as const,
  fit: 'on' as const,
  extraFlags: '',
  modelPath: '/models/my-model.gguf',
};

describe('ModelConfig', () => {
  beforeEach(() => {
    vi.mocked(configService.getModelsDirectory).mockReturnValue('/models');
    vi.mocked(configService.getEffective).mockReturnValue(DEFAULT_RESOLVED as any);
    vi.mocked(configService.getModelConfigNames).mockReturnValue([]);
    vi.mocked(configService.saveModelConfig).mockResolvedValue(undefined);
    vi.mocked(useServer).mockReturnValue({
      running: false, modelFile: null, configName: null, port: null, pid: null,
      uptimeSeconds: 0, logs: [], error: null, start: vi.fn(), stop: vi.fn(),
    } as any);
  });

  it('renders config form with all fields', () => {
    const { lastFrame } = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Alias');
    expect(lastFrame()).toContain('Temperature');
    expect(lastFrame()).toContain('Port');
    expect(lastFrame()).toContain('Context Size');
    expect(lastFrame()).toContain('Flash Attention');
  });

  it('shows config name selector', () => {
    const { lastFrame } = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Config');
    expect(lastFrame()).toContain('default');
  });

  it('calls onBack when Escape is pressed', async () => {
    const onBack = vi.fn();
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={onBack} onNavigate={vi.fn()} />,
    );
    instance.stdin.write('\x1B'); // ESC
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('saves config on Ctrl+S', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    instance.stdin.write('\x13'); // Ctrl+S
    await vi.waitFor(() => {
      expect(vi.mocked(configService.saveModelConfig)).toHaveBeenCalledWith(
        'my-model.gguf',
        'default',
        expect.any(Object),
      );
    });
  });

  it('shows save & launch button', () => {
    const { lastFrame } = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(lastFrame()).toContain('[S] Save');
    expect(lastFrame()).toContain('[L] Save & Launch');
  });

  it('navigates field with arrow keys', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    // Press down to move focus to Alias field (index 1)
    instance.stdin.write('\x1B[B'); // Down arrow
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('←/→');
    });
  });

  it('edits alias field with typing', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    // Navigate down past alias (focusIndex=1) to temp (focusIndex=2, shows ±0.1)
    // then further down to each field to exercise FieldEditor branches
    instance.stdin.write('\x1B[B'); // focusIndex=1 Alias
    instance.stdin.write('\x1B[B'); // focusIndex=2 Temp
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('±0.1'));
    // Navigate back up covers upArrow branch
    instance.stdin.write('\x1B[A'); // focusIndex=1 Alias
    await new Promise((r) => setTimeout(r, 30));
    instance.stdin.write('X'); // type X at alias
    // Component should not crash and still render
    await new Promise((r) => setTimeout(r, 50));
    expect(instance.lastFrame()).toContain('Alias');
  });

  it('changes temperature with left/right arrows', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    // Navigate to Temperature field (focusIndex=2 → press down twice)
    instance.stdin.write('\x1B[B'); // → focusIndex=1 (Alias)
    instance.stdin.write('\x1B[B'); // → focusIndex=2 (Temp)
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('±0.1'));
    instance.stdin.write('\x1B[C'); // Right arrow → temp+0.1
    await vi.waitFor(() => {
      // 0.6 + 0.1 = 0.7
      expect(instance.lastFrame()).toContain('0.7');
    });
  });

  it('saves and launches on Ctrl+L', async () => {
    const onNavigate = vi.fn();
    vi.mocked(configService.saveModelConfig).mockResolvedValue(undefined);
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={onNavigate} />,
    );
    instance.stdin.write('\x0C'); // Ctrl+L
    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('model-launch', expect.any(Object));
    });
  });

  it('adjusts port and ctxSize fields with left/right arrows', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    // Navigate to Port field (focusIndex=6 = FIELDS[5]='port' → fieldIdx=5)
    for (let i = 0; i < 6; i++) {
      instance.stdin.write('\x1B[B');
    }
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('±1'));
    instance.stdin.write('\x1B[C'); // Right → port+1
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('8002');
    });
  });

  it('adjusts topP, topK, minP fields', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    // Navigate to topP (focusIndex=3, shows ±0.05)
    for (let i = 0; i < 3; i++) {
      instance.stdin.write('\x1B[B');
    }
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('±0.05'));
    instance.stdin.write('\x1B[C'); // Right → topP+0.05 (0.95 → 1)
    await new Promise((r) => setTimeout(r, 50));
    // Navigate to topK (focusIndex=4, shows ±1)
    instance.stdin.write('\x1B[B');
    await vi.waitFor(() => {
      const frame = instance.lastFrame() ?? '';
      expect(frame).toContain('Top-K');
    });
    instance.stdin.write('\x1B[C'); // Right → topK+1
    await new Promise((r) => setTimeout(r, 50));
    // Navigate to minP (focusIndex=5, shows ±0.01)
    instance.stdin.write('\x1B[B');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('±0.01'));
    instance.stdin.write('\x1B[D'); // Left → minP-0.01
    await new Promise((r) => setTimeout(r, 50));
    expect(instance.lastFrame()).toContain('Min-P');
  });

  it('adjusts cache type field with left/right arrows', async () => {
    const instance = render(
      <ModelConfig modelFile="my-model.gguf" onBack={vi.fn()} onNavigate={vi.fn()} />,
    );
    // Navigate to Cache Type K field (focusIndex=8)
    for (let i = 0; i < 8; i++) {
      instance.stdin.write('\x1B[B');
    }
    await vi.waitFor(() => {
      const frame = instance.lastFrame() ?? '';
      expect(frame).toContain('Cache Type K');
    });
    instance.stdin.write('\x1B[C'); // Right → cycle cache type
    await new Promise((r) => setTimeout(r, 50));
    // Navigate to flashAttn (focusIndex=10)
    for (let i = 8; i < 10; i++) {
      instance.stdin.write('\x1B[B');
      await new Promise((r) => setTimeout(r, 30));
    }
    instance.stdin.write('\x1B[C'); // Right → toggle flash attention
    await new Promise((r) => setTimeout(r, 50));
    expect(instance.lastFrame()).toContain('FIT');
  });
});
