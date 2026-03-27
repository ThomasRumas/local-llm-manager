import { describe, it, expect } from 'vitest';
import type React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useScreen } from './use-screen.js';

// Wrapper component that renders screen/params as text and exposes navigate/goBack via ref
function UseScreenWrapper({
  apiRef,
}: Readonly<{
  apiRef: React.MutableRefObject<ReturnType<typeof useScreen> | null>;
}>) {
  const api = useScreen();
  apiRef.current = api;
  return (
    <Text>
      {api.screen}:{JSON.stringify(api.params)}
    </Text>
  );
}

describe('useScreen()', () => {
  it('initialises with dashboard screen', () => {
    const apiRef = { current: null as ReturnType<typeof useScreen> | null };
    const { lastFrame } = render(<UseScreenWrapper apiRef={apiRef} />);
    expect(lastFrame()).toContain('dashboard');
    expect(lastFrame()).toContain('{}');
  });

  it('navigate() changes screen', async () => {
    const apiRef = { current: null as ReturnType<typeof useScreen> | null };
    const { lastFrame } = render(<UseScreenWrapper apiRef={apiRef} />);
    apiRef.current?.navigate('settings', {});
    await vi.waitFor(() => expect(lastFrame()).toContain('settings'));
  });

  it('navigate() passes params', async () => {
    const apiRef = { current: null as ReturnType<typeof useScreen> | null };
    const { lastFrame } = render(<UseScreenWrapper apiRef={apiRef} />);
    apiRef.current?.navigate('model-config', { modelFile: 'test.gguf' });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('model-config');
      expect(lastFrame()).toContain('test.gguf');
    });
  });

  it('goBack() restores previous screen', () => {
    const apiRef = { current: null as ReturnType<typeof useScreen> | null };
    const { lastFrame } = render(<UseScreenWrapper apiRef={apiRef} />);
    apiRef.current?.navigate('settings', {});
    apiRef.current?.goBack();
    expect(lastFrame()).toContain('dashboard');
  });

  it('goBack() with no history resets to dashboard', () => {
    const apiRef = { current: null as ReturnType<typeof useScreen> | null };
    const { lastFrame } = render(<UseScreenWrapper apiRef={apiRef} />);
    apiRef.current?.goBack();
    expect(lastFrame()).toContain('dashboard');
  });
});
