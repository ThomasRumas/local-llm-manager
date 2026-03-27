import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useAsync } from './use-async.js';

// ── Test wrapper component ────────────────────────────────────────────────────
function UseAsyncWrapper({ fn }: Readonly<{ fn: () => Promise<string> }>) {
  const { data, loading, error } = useAsync(fn, []);
  if (loading) return <Text>loading</Text>;
  if (error) return <Text>error:{error}</Text>;
  return <Text>data:{data}</Text>;
}

describe('useAsync()', () => {
  it('starts in loading state', async () => {
    let resolve!: (v: string) => void;
    const fn = () =>
      new Promise<string>((r) => {
        resolve = r;
      });

    const { lastFrame } = render(<UseAsyncWrapper fn={fn} />);
    expect(lastFrame()).toContain('loading');
    resolve('done');
  });

  it('returns data on success', async () => {
    const fn = vi.fn().mockResolvedValueOnce('hello');
    const instance = render(<UseAsyncWrapper fn={fn} />);
    // Wait for async resolution
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('data:hello');
    });
  });

  it('returns error string on rejection', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const instance = render(<UseAsyncWrapper fn={fn} />);
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('error:boom');
    });
  });

  it('stringifies non-Error rejections', async () => {
    const fn = vi.fn().mockRejectedValueOnce('raw string error');
    const instance = render(<UseAsyncWrapper fn={fn} />);
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('error:raw string error');
    });
  });
});
