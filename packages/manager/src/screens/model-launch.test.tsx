import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../contexts/server-context.js', () => ({
  useServer: vi.fn(),
}));

vi.mock('../modules/config/config.service.js', () => ({
  configService: {
    getModelsDirectory: vi.fn(),
    getEffective: vi.fn(),
    getModelDisplayName: vi.fn(),
  },
}));

vi.mock('../hooks/use-system-stats.js', () => ({
  useSystemStats: vi.fn().mockReturnValue(null),
}));

import { useServer } from '../contexts/server-context.js';
import { configService } from '../modules/config/config.service.js';
import { useSystemStats } from '../hooks/use-system-stats.js';
import { ModelLaunch } from './model-launch.js';

const SERVER_RUNNING = {
  running: true,
  modelFile: 'model-a.gguf',
  configName: 'default',
  port: 8001,
  pid: 5678,
  uptimeSeconds: 45,
  logs: ['Server listening on port 8001', 'Model loaded'],
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
};

describe('ModelLaunch', () => {
  beforeEach(() => {
    vi.mocked(useServer).mockReturnValue(SERVER_RUNNING as any);
    vi.mocked(configService.getModelsDirectory).mockReturnValue('/models');
    vi.mocked(configService.getEffective).mockReturnValue({} as any);
    vi.mocked(configService.getModelDisplayName).mockImplementation((f) =>
      f.replace(/\.gguf$/, ''),
    );
    vi.mocked(useSystemStats).mockReturnValue(null);
  });

  it('renders server running state', () => {
    const { lastFrame } = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Running');
    expect(lastFrame()).toContain(':8001');
    expect(lastFrame()).toContain('45s');
  });

  it('renders stopped state', () => {
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      running: false,
      port: null,
      pid: null,
    } as any);
    const { lastFrame } = render(
      <ModelLaunch modelFile="model-a.gguf" onBack={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Stopped');
  });

  it('displays log lines', () => {
    const { lastFrame } = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Server listening');
  });

  it('calls onBack when Escape is pressed', async () => {
    const onBack = vi.fn();
    const instance = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={onBack}
      />,
    );
    instance.stdin.write('\x1B'); // ESC
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('calls server.stop when s is pressed', async () => {
    const stopMock = vi.fn();
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      stop: stopMock,
    } as any);
    const instance = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={vi.fn()}
      />,
    );
    instance.stdin.write('s');
    await vi.waitFor(() => expect(stopMock).toHaveBeenCalled());
  });

  it('shows server error when present', () => {
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      error: 'Port already in use',
    } as any);
    const { lastFrame } = render(
      <ModelLaunch modelFile="model-a.gguf" onBack={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Port already in use');
  });

  it('renders uptime in minutes format', () => {
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      uptimeSeconds: 90, // 1m 30s
    } as any);
    const { lastFrame } = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('1m');
  });

  it('renders uptime in hours format', () => {
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      uptimeSeconds: 3700, // 1h 1m
    } as any);
    const { lastFrame } = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('1h');
  });

  it('renders system stats when available', () => {
    vi.mocked(useSystemStats).mockReturnValue({
      cpuPercent: 35,
      ramUsedBytes: 8_000_000_000,
      ramTotalBytes: 16_000_000_000,
      vramLabel: 'Unified 16GB',
      processCpuPercent: 10.5,
      processRamBytes: 2_000_000_000,
    });
    const { lastFrame } = render(
      <ModelLaunch
        modelFile="model-a.gguf"
        configName="default"
        onBack={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('35%');
    expect(lastFrame()).toContain('GB');
  });
});
