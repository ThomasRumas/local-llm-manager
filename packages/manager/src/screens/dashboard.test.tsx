import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../contexts/server-context.js', () => ({
  useServer: vi.fn(),
}));

vi.mock('../modules/config/config.service.js', () => ({
  configService: {
    getHfToken: vi.fn(),
    getModelDisplayName: vi.fn((f: string) => f),
  },
}));

vi.mock('../hooks/use-system-stats.js', () => ({
  useSystemStats: vi.fn().mockReturnValue(null),
}));

// useApp().exit needs an Ink App context — mock it
vi.mock('ink', async (importActual) => {
  const actual = await importActual<typeof import('ink')>();
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

import { useServer } from '../contexts/server-context.js';
import { configService } from '../modules/config/config.service.js';
import { useSystemStats } from '../hooks/use-system-stats.js';
import { Dashboard } from './dashboard.js';

const SERVER_STOPPED = {
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
};

const SERVER_RUNNING = {
  running: true,
  modelFile: 'model-a.gguf',
  configName: 'default',
  port: 8080,
  pid: 1234,
  uptimeSeconds: 90,
  logs: ['Server started'],
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(useServer).mockReturnValue(SERVER_STOPPED as any);
    vi.mocked(configService.getHfToken).mockReturnValue(undefined);
    vi.mocked(configService.getModelDisplayName).mockImplementation(
      (f: string) => f,
    );
    vi.mocked(useSystemStats).mockReturnValue(null);
  });

  it('renders quick actions menu', () => {
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Install');
    expect(lastFrame()).toContain('Search Models');
    expect(lastFrame()).toContain('My Models');
    expect(lastFrame()).toContain('Settings');
  });

  it('shows server stopped state', () => {
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('No Server Running');
  });

  it('shows server running state with details', () => {
    vi.mocked(useServer).mockReturnValue(SERVER_RUNNING as any);
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Server Running');
    expect(lastFrame()).toContain(':8080');
    expect(lastFrame()).toContain('1m 30s');
  });

  it('shows no HF token message when not set', () => {
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('No Hugging Face Token');
  });

  it('shows HF token set when configured', () => {
    vi.mocked(configService.getHfToken).mockReturnValue('hf_abc123xyz');
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Hugging Face Token Set');
  });

  it('calls onNavigate with correct screen on shortcut key', async () => {
    const onNavigate = vi.fn();
    const { stdin } = render(<Dashboard onNavigate={onNavigate} />);
    stdin.write('2');
    await vi.waitFor(() => expect(onNavigate).toHaveBeenCalledWith('search'));
  });

  it('shows recent logs panel when server has logs', () => {
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      logs: ['line1', 'line2', 'line3'],
    } as any);
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Recent Logs');
  });

  it('shows hours in uptime when server running > 1 hour', () => {
    vi.mocked(useServer).mockReturnValue({
      ...SERVER_RUNNING,
      uptimeSeconds: 3700, // 1h 1m
    } as any);
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('1h');
  });

  it('shows system stats when available', () => {
    vi.mocked(useSystemStats).mockReturnValue({
      cpuPercent: 45,
      ramUsedBytes: 8_000_000_000,
      ramTotalBytes: 16_000_000_000,
      vramLabel: 'Unified 16GB',
      processCpuPercent: null,
      processRamBytes: null,
    });
    const { lastFrame } = render(<Dashboard onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('45%');
    expect(lastFrame()).toContain('GB');
  });

  it('navigates menu with up/down arrow keys', async () => {
    const instance = render(<Dashboard onNavigate={vi.fn()} />);
    instance.stdin.write('\x1B[B'); // Down
    await new Promise((r) => setTimeout(r, 50));
    instance.stdin.write('\x1B[A'); // Up
    await new Promise((r) => setTimeout(r, 50));
    // Should not crash
    expect(instance.lastFrame()).toContain('Install');
  });

  it('navigates to screen on Enter key', async () => {
    const onNavigate = vi.fn();
    const instance = render(<Dashboard onNavigate={onNavigate} />);
    instance.stdin.write('\r'); // Enter → navigate to first action (install)
    await vi.waitFor(() => expect(onNavigate).toHaveBeenCalledWith('install'));
  });

  it('navigates to monitor when m is pressed and server running', async () => {
    vi.mocked(useServer).mockReturnValue(SERVER_RUNNING as any);
    const onNavigate = vi.fn();
    const { stdin } = render(<Dashboard onNavigate={onNavigate} />);
    stdin.write('m');
    await vi.waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith('model-launch'),
    );
  });
});
