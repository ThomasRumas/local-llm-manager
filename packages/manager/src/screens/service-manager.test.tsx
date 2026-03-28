import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import type { ServiceStatus } from '../modules/daemon/service.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRefresh = vi.fn();
let mockStatus: ServiceStatus & {
  loading: boolean;
  error: string | null;
  refresh: () => void;
} = {
  installed: false,
  running: false,
  pid: undefined,
  loading: false,
  error: null,
  refresh: mockRefresh,
};

vi.mock('../contexts/service-status-context.js', () => ({
  useServiceStatusContext: () => mockStatus,
}));

vi.mock('../modules/daemon/service.js', () => ({
  installService: vi.fn(),
  uninstallService: vi.fn(),
  startService: vi.fn(),
  stopService: vi.fn(),
}));

import {
  installService,
  uninstallService,
  startService,
  stopService,
} from '../modules/daemon/service.js';
import { ServiceManager } from './service-manager.js';

const mockInstall = vi.mocked(installService);
const mockUninstall = vi.mocked(uninstallService);
const mockStart = vi.mocked(startService);
const mockStop = vi.mocked(stopService);

// ── Helpers ───────────────────────────────────────────────────────────────────

function notInstalled() {
  mockStatus = {
    installed: false,
    running: false,
    pid: undefined,
    loading: false,
    error: null,
    refresh: mockRefresh,
  };
}

function installedStopped() {
  mockStatus = {
    installed: true,
    running: false,
    pid: undefined,
    loading: false,
    error: null,
    refresh: mockRefresh,
  };
}

function installedRunning(pid = 1234) {
  mockStatus = {
    installed: true,
    running: true,
    pid,
    loading: false,
    error: null,
    refresh: mockRefresh,
  };
}

function loading() {
  mockStatus = {
    installed: false,
    running: false,
    pid: undefined,
    loading: true,
    error: null,
    refresh: mockRefresh,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Collect all rendered instances so we can unmount them after each test.
// ink-testing-library registers useInput handlers globally; without cleanup
// old instances from previous tests fire their handlers on the new test's stdin.
const rendered: Array<{ unmount: () => void }> = [];

function mount(onBack = vi.fn()) {
  const instance = render(<ServiceManager onBack={onBack} />);
  rendered.push(instance);
  return instance;
}

describe('ServiceManager', () => {
  beforeEach(() => {
    notInstalled();
    mockRefresh.mockReset();
  });

  afterEach(() => {
    while (rendered.length) rendered.pop()?.unmount();
  });

  // ── Status display ──────────────────────────────────────────────────────────

  describe('status display', () => {
    it('shows "Checking..." while loading', () => {
      loading();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('Checking...');
    });

    it('shows "Not installed" when service is not installed', () => {
      notInstalled();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('Not installed');
    });

    it('shows "Stopped" when installed but not running', () => {
      installedStopped();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('Stopped');
    });

    it('shows "Running" with PID when installed and running', () => {
      installedRunning(5678);
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('Running');
      expect(lastFrame()).toContain('5678');
    });

    it('shows "Running" without PID when pid is undefined', () => {
      mockStatus = {
        installed: true,
        running: true,
        pid: undefined,
        loading: false,
        error: null,
        refresh: mockRefresh,
      };
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('Running');
      expect(lastFrame()).not.toContain('PID');
    });

    it('shows error message when status has an error', () => {
      mockStatus = {
        installed: false,
        running: false,
        pid: undefined,
        loading: false,
        error: 'launchctl unavailable',
        refresh: mockRefresh,
      };
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('launchctl unavailable');
    });
  });

  // ── Action hints ────────────────────────────────────────────────────────────

  describe('action hints', () => {
    it('hides action panel while loading', () => {
      loading();
      const { lastFrame } = mount();
      expect(lastFrame()).not.toContain('[i]');
      expect(lastFrame()).not.toContain('[s]');
    });

    it('shows [i] install hint when not installed', () => {
      notInstalled();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('[i]');
      expect(lastFrame()).toContain('Install service');
    });

    it('does not show [i] when already installed', () => {
      installedStopped();
      const { lastFrame } = mount();
      expect(lastFrame()).not.toContain('Install service');
    });

    it('shows [s] start and [u] uninstall when installed and stopped', () => {
      installedStopped();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('[s]');
      expect(lastFrame()).toContain('Start service');
      expect(lastFrame()).toContain('[u]');
      expect(lastFrame()).toContain('Uninstall');
    });

    it('shows [s] stop and [u] uninstall when installed and running', () => {
      installedRunning();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('[s]');
      expect(lastFrame()).toContain('Stop service');
      expect(lastFrame()).toContain('[u]');
      expect(lastFrame()).toContain('Uninstall');
    });

    it('always shows [r] refresh hint when not loading', () => {
      notInstalled();
      const { lastFrame } = mount();
      expect(lastFrame()).toContain('[r]');
    });
  });

  // ── Keyboard: navigation ────────────────────────────────────────────────────

  describe('keyboard navigation', () => {
    it('calls onBack when Escape is pressed', async () => {
      notInstalled();
      const onBack = vi.fn();
      const { stdin } = mount(onBack);
      stdin.write('\x1B'); // ESC
      await vi.waitFor(() => expect(onBack).toHaveBeenCalledOnce());
    });

    it('calls refresh when r is pressed', () => {
      notInstalled();
      const { stdin } = mount();
      stdin.write('r');
      expect(mockRefresh).toHaveBeenCalledOnce();
    });

    it('calls refresh when Enter is pressed', () => {
      notInstalled();
      const { stdin } = mount();
      stdin.write('\r'); // Enter
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  // ── Keyboard: install ───────────────────────────────────────────────────────

  describe('install action', () => {
    it('calls installService when i pressed and not installed', async () => {
      notInstalled();
      mockInstall.mockResolvedValueOnce(undefined);
      const { stdin, lastFrame } = mount();
      stdin.write('i');
      await vi.waitFor(() => expect(mockInstall).toHaveBeenCalledOnce());
      await vi.waitFor(() =>
        expect(lastFrame()).toContain('installed successfully'),
      );
    });

    it('shows busy label while installing', async () => {
      notInstalled();
      let resolveInstall!: () => void;
      mockInstall.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolveInstall = r;
        }),
      );
      const { stdin, lastFrame } = mount();
      stdin.write('i');
      await vi.waitFor(() =>
        expect(lastFrame()).toContain('Installing service'),
      );
      resolveInstall();
    });

    it('shows error when installService rejects', async () => {
      notInstalled();
      mockInstall.mockRejectedValueOnce(new Error('permission denied'));
      const { stdin, lastFrame } = mount();
      stdin.write('i');
      await vi.waitFor(() =>
        expect(lastFrame()).toContain('permission denied'),
      );
    });

    it('calls refresh after successful install', async () => {
      notInstalled();
      mockInstall.mockResolvedValueOnce(undefined);
      const { stdin } = mount();
      stdin.write('i');
      await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    });

    it('does not call installService when i pressed but already installed', () => {
      installedStopped();
      const { stdin } = mount();
      stdin.write('i');
      expect(mockInstall).not.toHaveBeenCalled();
    });
  });

  // ── Keyboard: uninstall ─────────────────────────────────────────────────────

  describe('uninstall action', () => {
    it('calls uninstallService when u pressed and installed', async () => {
      installedStopped();
      mockUninstall.mockResolvedValueOnce(undefined);
      const { stdin, lastFrame } = mount();
      stdin.write('u');
      await vi.waitFor(() => expect(mockUninstall).toHaveBeenCalledOnce());
      await vi.waitFor(() =>
        expect(lastFrame()).toContain('Service uninstalled'),
      );
    });

    it('shows busy label while uninstalling', async () => {
      installedStopped();
      let resolve!: () => void;
      mockUninstall.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolve = r;
        }),
      );
      const { stdin, lastFrame } = mount();
      stdin.write('u');
      await vi.waitFor(() =>
        expect(lastFrame()).toContain('Uninstalling service'),
      );
      resolve();
    });

    it('shows error when uninstallService rejects', async () => {
      installedStopped();
      mockUninstall.mockRejectedValueOnce(new Error('uninstall failed'));
      const { stdin, lastFrame } = mount();
      stdin.write('u');
      await vi.waitFor(() => expect(lastFrame()).toContain('uninstall failed'));
    });

    it('does not call uninstallService when u pressed and not installed', () => {
      notInstalled();
      const { stdin } = mount();
      stdin.write('u');
      expect(mockUninstall).not.toHaveBeenCalled();
    });
  });

  // ── Keyboard: start / stop ──────────────────────────────────────────────────

  describe('start action', () => {
    it('calls startService when s pressed and installed+stopped', async () => {
      installedStopped();
      mockStart.mockResolvedValueOnce(undefined);
      const { stdin, lastFrame } = mount();
      stdin.write('s');
      await vi.waitFor(() => expect(mockStart).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(lastFrame()).toContain('Service started'));
    });

    it('shows busy label while starting', async () => {
      installedStopped();
      let resolve!: () => void;
      mockStart.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolve = r;
        }),
      );
      const { stdin, lastFrame } = mount();
      stdin.write('s');
      await vi.waitFor(() => expect(lastFrame()).toContain('Starting service'));
      resolve();
    });

    it('shows error when startService rejects', async () => {
      installedStopped();
      mockStart.mockRejectedValueOnce(new Error('start error'));
      const { stdin, lastFrame } = mount();
      stdin.write('s');
      await vi.waitFor(() => expect(lastFrame()).toContain('start error'));
    });

    it('does not call startService when s pressed and not installed', () => {
      notInstalled();
      const { stdin } = mount();
      stdin.write('s');
      expect(mockStart).not.toHaveBeenCalled();
    });
  });

  describe('stop action', () => {
    it('calls stopService when s pressed and running', async () => {
      installedRunning();
      mockStop.mockResolvedValueOnce(undefined);
      const { stdin, lastFrame } = mount();
      stdin.write('s');
      await vi.waitFor(() => expect(mockStop).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(lastFrame()).toContain('Service stopped'));
    });

    it('shows busy label while stopping', async () => {
      installedRunning();
      let resolve!: () => void;
      mockStop.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolve = r;
        }),
      );
      const { stdin, lastFrame } = mount();
      stdin.write('s');
      await vi.waitFor(() => expect(lastFrame()).toContain('Stopping service'));
      resolve();
    });

    it('shows error when stopService rejects', async () => {
      installedRunning();
      mockStop.mockRejectedValueOnce(new Error('stop error'));
      const { stdin, lastFrame } = mount();
      stdin.write('s');
      await vi.waitFor(() => expect(lastFrame()).toContain('stop error'));
    });
  });

  // ── Busy guard ──────────────────────────────────────────────────────────────

  describe('busy guard', () => {
    it('ignores action keys while an action is in progress', async () => {
      notInstalled();
      let resolveInstall!: () => void;
      mockInstall.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolveInstall = r;
        }),
      );
      const { stdin, lastFrame } = mount();

      // Trigger install
      stdin.write('i');
      await vi.waitFor(() =>
        expect(lastFrame()).toContain('Installing service'),
      );

      // Press i again while busy — should not spawn a second call
      stdin.write('i');
      expect(mockInstall).toHaveBeenCalledTimes(1);

      resolveInstall();
    });
  });
});
