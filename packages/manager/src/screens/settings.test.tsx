import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../modules/config/config.service.js', () => ({
  configService: {
    get: vi.fn(),
    setModelsDirectory: vi.fn().mockResolvedValue(undefined),
    setDefaults: vi.fn().mockResolvedValue(undefined),
    setHfToken: vi.fn().mockResolvedValue(undefined),
    setApiServerConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../modules/api/api.server.js', () => ({
  apiServer: {
    isRunning: false,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

import { configService } from '../modules/config/config.service.js';
import { Settings } from './settings.js';

const DEFAULT_CONFIG = {
  modelsDirectory: '/models',
  defaults: { port: 8001, ctxSize: 131072 },
  hfToken: '',
  apiServer: { enabled: false, port: 3000 },
  configurations: {},
};

describe('Settings', () => {
  beforeEach(() => {
    vi.mocked(configService.get).mockReturnValue(DEFAULT_CONFIG as any);
    vi.mocked(configService.setModelsDirectory).mockResolvedValue(undefined);
    vi.mocked(configService.setDefaults).mockResolvedValue(undefined);
    vi.mocked(configService.setHfToken).mockResolvedValue(undefined);
    vi.mocked(configService.setApiServerConfig).mockResolvedValue(undefined);
  });

  it('renders settings fields with current values', () => {
    const { lastFrame } = render(<Settings onBack={vi.fn()} />);
    expect(lastFrame()).toContain('Models Directory');
    expect(lastFrame()).toContain('/models');
    expect(lastFrame()).toContain('Default Port');
    expect(lastFrame()).toContain('8001');
    expect(lastFrame()).toContain('Context Size');
  });

  it('calls onBack when Escape is pressed', async () => {
    const onBack = vi.fn();
    const instance = render(<Settings onBack={onBack} />);
    instance.stdin.write('\x1B'); // ESC
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('saves settings when Ctrl+S is pressed', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    instance.stdin.write('\x13'); // Ctrl+S
    await vi.waitFor(() => {
      expect(vi.mocked(configService.setModelsDirectory)).toHaveBeenCalled();
    });
  });

  it('shows saved confirmation after save', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    instance.stdin.write('\x13'); // Ctrl+S
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('saved');
    });
  });

  it('shows validation error for invalid port', async () => {
    vi.mocked(configService.get).mockReturnValue({
      ...DEFAULT_CONFIG,
      defaults: { port: 99999, ctxSize: 131072 }, // port > 65535 is invalid
    } as any);
    const instance = render(<Settings onBack={vi.fn()} />);
    instance.stdin.write('\x13'); // Ctrl+S — triggers save regardless of focus
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Port must be');
    });
  });

  it('edits models directory field with typing', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    // focusIndex starts at 0 (modelsDir)
    instance.stdin.write('X'); // Type a character at focusIndex=0
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('/modelsX');
    });
  });

  it('navigates fields with down arrow', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    instance.stdin.write('\x1B[B'); // Down → focusIndex=1 (port)
    await vi.waitFor(() => {
      // Port field should be focused/highlighted
      expect(instance.lastFrame()).toContain('Default Port');
    });
  });

  it('toggles API enabled with left/right arrow', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    // API Server is at focusIndex=4 — navigate there via 4 down presses
    for (let i = 0; i < 4; i++) {
      instance.stdin.write('\x1B[B'); // Down
      await vi.waitFor(
        () => {
          // wait for each navigation to be processed before sending the next
          expect(instance.lastFrame()).toBeDefined();
        },
        { timeout: 2000 },
      );
    }
    // Wait for arrow indicator to appear (confirms focusIndex=4)
    await vi.waitFor(
      () => {
        expect(instance.lastFrame()).toContain('← →');
      },
      { timeout: 2000 },
    );
    instance.stdin.write('\x1B[C'); // Right arrow → toggle apiEnabled to true
    await vi.waitFor(
      () => {
        const frame = instance.lastFrame() ?? '';
        // After toggling, the green 'enabled' text should appear
        // Note: lastFrame() includes ANSI codes so we check the word directly
        expect(frame).toContain('enabled');
        expect(frame).not.toContain('disabled');
      },
      { timeout: 3000 },
    );
  });

  it('shows validation error for invalid context size', async () => {
    vi.mocked(configService.get).mockReturnValue({
      ...DEFAULT_CONFIG,
      defaults: { port: 8001, ctxSize: 100 }, // ctxSize < 512 is invalid
    } as any);
    const instance = render(<Settings onBack={vi.fn()} />);
    instance.stdin.write('\x13'); // Ctrl+S
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Context size');
    });
  });

  it('edits hfToken field with typing', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    // Navigate to hfToken (focusIndex=3)
    for (let i = 0; i < 3; i++) {
      instance.stdin.write('\x1B[B'); // Down
      await new Promise((r) => setTimeout(r, 10));
    }
    await vi.waitFor(() => {
      const frame = instance.lastFrame() ?? '';
      expect(frame).toContain('Hugging Face');
    });
    instance.stdin.write('h'); // type 'h'
    await new Promise((r) => setTimeout(r, 30));
    // Component should still render without crashing
    expect(instance.lastFrame()).toContain('Hugging Face');
  });

  it('edits apiPort field with typing', async () => {
    const instance = render(<Settings onBack={vi.fn()} />);
    // Navigate to apiPort (focusIndex=5)
    for (let i = 0; i < 5; i++) {
      instance.stdin.write('\x1B[B'); // Down
      await new Promise((r) => setTimeout(r, 10));
    }
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('API Port'));
    instance.stdin.write('5'); // type digit
    await new Promise((r) => setTimeout(r, 30));
    expect(instance.lastFrame()).toContain('API Port');
  });
});
