import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { ServiceStatusState } from './service-status-context.js';

// ── Mock useServiceStatus ─────────────────────────────────────────────────────
// Must be hoisted so the mock is set up before the module is imported.

const mockRefresh = vi.fn();
const mockUseServiceStatus = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-service-status.js', () => ({
  useServiceStatus: mockUseServiceStatus,
}));

import {
  ServiceStatusProvider,
  useServiceStatusContext,
} from './service-status-context.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STOPPED_STATE: ServiceStatusState & { refresh: () => void } = {
  installed: true,
  running: false,
  pid: undefined,
  loading: false,
  error: null,
  refresh: mockRefresh,
};

const RUNNING_STATE: ServiceStatusState & { refresh: () => void } = {
  installed: true,
  running: true,
  pid: 9876,
  loading: false,
  error: null,
  refresh: mockRefresh,
};

// ── Consumer component ────────────────────────────────────────────────────────

function Consumer() {
  const { installed, running, pid, loading, error } = useServiceStatusContext();
  return (
    <Text>{JSON.stringify({ installed, running, pid, loading, error })}</Text>
  );
}

function parseFrame(frame: string | undefined): Record<string, unknown> {
  const match = /(\{.+\})/.exec(frame ?? '');
  return match ? (JSON.parse(match[1]) as Record<string, unknown>) : {};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ServiceStatusProvider / useServiceStatusContext()', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockUseServiceStatus.mockReturnValue(STOPPED_STATE);
  });

  // ── Provider passes hook state to children ──────────────────────────────────

  it('provides installed and running state to consumers', () => {
    const { lastFrame } = render(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );
    const state = parseFrame(lastFrame());
    expect(state.installed).toBe(true);
    expect(state.running).toBe(false);
  });

  it('provides pid when service is running', () => {
    mockUseServiceStatus.mockReturnValue(RUNNING_STATE);
    const { lastFrame } = render(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );
    const state = parseFrame(lastFrame());
    expect(state.running).toBe(true);
    expect(state.pid).toBe(9876);
  });

  it('provides loading state', () => {
    mockUseServiceStatus.mockReturnValue({
      ...STOPPED_STATE,
      loading: true,
    });
    const { lastFrame } = render(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );
    expect(parseFrame(lastFrame()).loading).toBe(true);
  });

  it('provides error message when hook reports an error', () => {
    mockUseServiceStatus.mockReturnValue({
      ...STOPPED_STATE,
      error: 'spawn failed',
    });
    const { lastFrame } = render(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );
    expect(parseFrame(lastFrame()).error).toBe('spawn failed');
  });

  it('provides null error when no error occurred', () => {
    const { lastFrame } = render(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );
    expect(parseFrame(lastFrame()).error).toBeNull();
  });

  // ── refresh() is forwarded ──────────────────────────────────────────────────

  it('exposes the refresh function from the hook', () => {
    function RefreshConsumer() {
      const { refresh } = useServiceStatusContext();
      refresh();
      return <Text>done</Text>;
    }
    render(
      <ServiceStatusProvider>
        <RefreshConsumer />
      </ServiceStatusProvider>,
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  // ── Default context value (outside provider) ────────────────────────────────

  it('useServiceStatusContext returns default value when used outside provider', () => {
    // No provider — should get the DEFAULT constant values
    const { lastFrame } = render(<Consumer />);
    const state = parseFrame(lastFrame());
    expect(state.installed).toBe(false);
    expect(state.running).toBe(false);
    expect(state.loading).toBe(true); // DEFAULT has loading:true
    expect(state.error).toBeNull();
  });

  // ── Multiple consumers share one hook instance ──────────────────────────────

  it('calls useServiceStatus exactly once per provider mount', () => {
    render(
      <ServiceStatusProvider>
        <Consumer />
        <Consumer />
      </ServiceStatusProvider>,
    );
    expect(mockUseServiceStatus).toHaveBeenCalledTimes(1);
  });

  it('two consumers inside the same provider see identical state', () => {
    mockUseServiceStatus.mockReturnValue(RUNNING_STATE);

    function TwoConsumers() {
      const a = useServiceStatusContext();
      const b = useServiceStatusContext();
      return (
        <Text>
          {a.pid === b.pid && a.running === b.running ? 'same' : 'different'}
        </Text>
      );
    }

    const { lastFrame } = render(
      <ServiceStatusProvider>
        <TwoConsumers />
      </ServiceStatusProvider>,
    );
    expect(lastFrame()).toContain('same');
  });

  // ── Reactive updates ────────────────────────────────────────────────────────

  it('reflects updated state when hook value changes', async () => {
    // Start stopped, then switch mock return to running
    const { lastFrame, rerender } = render(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );

    expect(parseFrame(lastFrame()).running).toBe(false);

    mockUseServiceStatus.mockReturnValue(RUNNING_STATE);
    rerender(
      <ServiceStatusProvider>
        <Consumer />
      </ServiceStatusProvider>,
    );

    await vi.waitFor(() => {
      expect(parseFrame(lastFrame()).running).toBe(true);
      expect(parseFrame(lastFrame()).pid).toBe(9876);
    });
  });
});
