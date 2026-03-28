import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { ServiceStatus } from '../modules/daemon/service.js';
import { useServiceStatus } from './use-service-status.js';

// ── Mock getServiceStatus ─────────────────────────────────────────────────────

const mockGetServiceStatus = vi.fn<() => Promise<ServiceStatus>>();

vi.mock('../modules/daemon/service.js', () => ({
  getServiceStatus: () => mockGetServiceStatus(),
}));

// ── Wrapper component ─────────────────────────────────────────────────────────

function Wrapper() {
  const { installed, running, pid, loading, error } = useServiceStatus();
  return (
    <Text>{JSON.stringify({ installed, running, pid, loading, error })}</Text>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFrame(frame: string | undefined): Record<string, unknown> {
  const match = /(\{.+\})/.exec(frame ?? '');
  return match ? (JSON.parse(match[1]) as Record<string, unknown>) : {};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useServiceStatus()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  it('starts in loading state before getServiceStatus resolves', () => {
    mockGetServiceStatus.mockReturnValue(new Promise(() => {})); // never resolves
    const { lastFrame } = render(<Wrapper />);
    expect(parseFrame(lastFrame())).toMatchObject({ loading: true });
  });

  it('initial state has installed:false and running:false', () => {
    mockGetServiceStatus.mockReturnValue(new Promise(() => {}));
    const { lastFrame } = render(<Wrapper />);
    const state = parseFrame(lastFrame());
    expect(state.installed).toBe(false);
    expect(state.running).toBe(false);
    expect(state.error).toBeNull();
  });

  // ── Successful resolution ───────────────────────────────────────────────────

  it('updates state when service is installed and running', async () => {
    mockGetServiceStatus.mockResolvedValue({
      installed: true,
      running: true,
      pid: 1234,
    });
    const { lastFrame } = render(<Wrapper />);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.loading).toBe(false);
      expect(state.installed).toBe(true);
      expect(state.running).toBe(true);
      expect(state.pid).toBe(1234);
      expect(state.error).toBeNull();
    });
  });

  it('updates state when service is installed but stopped', async () => {
    mockGetServiceStatus.mockResolvedValue({
      installed: true,
      running: false,
    });
    const { lastFrame } = render(<Wrapper />);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.installed).toBe(true);
      expect(state.running).toBe(false);
      expect(state.pid).toBeUndefined();
      expect(state.loading).toBe(false);
    });
  });

  it('updates state when service is not installed', async () => {
    mockGetServiceStatus.mockResolvedValue({
      installed: false,
      running: false,
    });
    const { lastFrame } = render(<Wrapper />);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.installed).toBe(false);
      expect(state.running).toBe(false);
      expect(state.loading).toBe(false);
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('sets error message when getServiceStatus rejects with an Error', async () => {
    mockGetServiceStatus.mockRejectedValue(new Error('permission denied'));
    const { lastFrame } = render(<Wrapper />);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.loading).toBe(false);
      expect(state.error).toBe('permission denied');
    });
  });

  it('stringifies non-Error rejections', async () => {
    mockGetServiceStatus.mockRejectedValue('raw failure');
    const { lastFrame } = render(<Wrapper />);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.error).toBe('raw failure');
      expect(state.loading).toBe(false);
    });
  });

  it('preserves installed/running state from previous successful fetch on error', async () => {
    mockGetServiceStatus
      .mockResolvedValueOnce({ installed: true, running: true, pid: 42 })
      .mockRejectedValue(new Error('network error'));

    const { lastFrame } = render(<Wrapper />);

    // Wait for first successful fetch
    await vi.waitFor(() => {
      expect(parseFrame(lastFrame()).installed).toBe(true);
    });

    // Advance timer to trigger the next poll (fails)
    await vi.advanceTimersByTimeAsync(5000);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.error).toBe('network error');
      // Previous values preserved — not reset to false
      expect(state.installed).toBe(true);
      expect(state.running).toBe(true);
    });
  });

  // ── Polling ─────────────────────────────────────────────────────────────────

  it('polls getServiceStatus every 5 seconds', async () => {
    mockGetServiceStatus.mockResolvedValue({
      installed: false,
      running: false,
    });
    render(<Wrapper />);

    // Initial call
    await vi.waitFor(() =>
      expect(mockGetServiceStatus).toHaveBeenCalledTimes(1),
    );

    // Advance 5 s → second poll
    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() =>
      expect(mockGetServiceStatus).toHaveBeenCalledTimes(2),
    );

    // Advance another 5 s → third poll
    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() =>
      expect(mockGetServiceStatus).toHaveBeenCalledTimes(3),
    );
  });

  it('does not poll after unmount', async () => {
    mockGetServiceStatus.mockResolvedValue({
      installed: false,
      running: false,
    });
    const { unmount } = render(<Wrapper />);

    await vi.waitFor(() =>
      expect(mockGetServiceStatus).toHaveBeenCalledTimes(1),
    );

    unmount();
    await vi.advanceTimersByTimeAsync(15_000);

    // Still only the initial call — no further polling after unmount
    expect(mockGetServiceStatus).toHaveBeenCalledTimes(1);
  });

  // ── refresh() ────────────────────────────────────────────────────────────────

  it('refresh() re-fetches and updates state (via poll tick)', async () => {
    mockGetServiceStatus
      .mockResolvedValueOnce({ installed: false, running: false })
      .mockResolvedValueOnce({ installed: true, running: true, pid: 99 });

    const { lastFrame } = render(<Wrapper />);

    // Wait for initial fetch to settle
    await vi.waitFor(() => expect(parseFrame(lastFrame()).loading).toBe(false));
    expect(parseFrame(lastFrame()).installed).toBe(false);

    // Advance timer to trigger the next poll (calls refresh internally)
    await vi.advanceTimersByTimeAsync(5000);

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.loading).toBe(false);
      expect(state.installed).toBe(true);
    });
    expect(mockGetServiceStatus).toHaveBeenCalledTimes(2);
  });

  it('refresh() sets loading:true before the new result arrives', async () => {
    let resolveSecond!: (v: ServiceStatus) => void;
    const secondCallPromise = new Promise<ServiceStatus>((r) => {
      resolveSecond = r;
    });

    mockGetServiceStatus
      .mockResolvedValueOnce({ installed: true, running: true, pid: 1 })
      .mockReturnValueOnce(secondCallPromise);

    const { lastFrame } = render(<Wrapper />);

    // Wait for initial state to settle
    await vi.waitFor(() => expect(parseFrame(lastFrame()).loading).toBe(false));

    // Trigger second poll — starts loading again
    await vi.advanceTimersByTimeAsync(5000);

    await vi.waitFor(() => {
      expect(parseFrame(lastFrame()).loading).toBe(true);
    });

    // Resolve the pending call
    resolveSecond({ installed: true, running: false });

    await vi.waitFor(() => {
      const state = parseFrame(lastFrame());
      expect(state.loading).toBe(false);
      expect(state.running).toBe(false);
    });
  });
});
