import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// ── Mock llamaService ─────────────────────────────────────────────────────────
vi.mock('../modules/llama/llama.service.js', () => ({
  llamaService: {
    detect: vi.fn(),
    install: vi.fn(),
  },
}));

import { llamaService } from '../modules/llama/llama.service.js';
import { InstallCheck } from './install-check.js';

const mockDetect = vi.mocked(llamaService.detect);
const mockInstall = vi.mocked(llamaService.install);

describe('InstallCheck', () => {
  it('shows loading state while detecting', () => {
    // Never resolves during this test
    mockDetect.mockReturnValueOnce(new Promise(() => {}));
    const { lastFrame } = render(<InstallCheck onBack={vi.fn()} />);
    expect(lastFrame()).toContain('Detecting');
  });

  it('shows installed status when llama-server is found', async () => {
    mockDetect.mockResolvedValueOnce({
      installed: true,
      path: '/usr/local/bin/llama-server',
      version: 'b123',
    });
    const instance = render(<InstallCheck onBack={vi.fn()} />);
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('installed');
    });
    expect(instance.lastFrame()).toContain('/usr/local/bin/llama-server');
  });

  it('shows warning when llama-server is not installed', async () => {
    mockDetect.mockResolvedValueOnce({ installed: false });
    const instance = render(<InstallCheck onBack={vi.fn()} />);
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('not found');
    });
    expect(instance.lastFrame()).toContain("Press 'i' to install");
  });

  it('calls onBack when Escape is pressed', async () => {
    mockDetect.mockResolvedValueOnce({ installed: true, path: '/bin/llama-server', version: '1.0' });
    const onBack = vi.fn();
    const instance = render(<InstallCheck onBack={onBack} />);
    // Wait for detect to complete so component is fully rendered and useInput registered
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('installed'));
    instance.stdin.write('\x1B'); // ESC
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('shows install progress when i is pressed and not installed', async () => {
    mockDetect.mockResolvedValue({ installed: false });
    mockInstall.mockImplementation(async (onData) => {
      onData('Downloading llama.cpp...\n');
      return { success: true };
    });

    const instance = render(<InstallCheck onBack={vi.fn()} />);
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('not found'));
    instance.stdin.write('i');
    await vi.waitFor(() => {
      expect(
        instance.lastFrame()!.includes('Installing') ||
        instance.lastFrame()!.includes('Installation complete'),
      ).toBe(true);
    });
  });
});
