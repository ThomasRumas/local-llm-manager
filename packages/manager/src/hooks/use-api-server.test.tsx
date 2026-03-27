import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock apiServer singleton ──────────────────────────────────────────────────
// vi.hoisted runs before imports, so we can't use EventEmitter from the import.
// Instead, create a minimal EventEmitter-like object using native Node.
const mockApiServer = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const eventsModule = require('node:events') as { EventEmitter: typeof import('node:events').EventEmitter };
  const emitter = Object.assign(new eventsModule.EventEmitter(), { isRunning: false, port: null as number | null });
  return emitter;
});

vi.mock('../modules/api/api.server.js', () => ({
  apiServer: mockApiServer,
}));

import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useApiServer } from './use-api-server.js';

function Wrapper() {
  const { isRunning, port } = useApiServer();
  return <Text>{JSON.stringify({ isRunning, port })}</Text>;
}

describe('useApiServer()', () => {
  beforeEach(() => {
    mockApiServer.isRunning = false;
    mockApiServer.port = null;
  });

  it('returns initial state from apiServer', () => {
    mockApiServer.isRunning = true;
    mockApiServer.port = 3333;
    const { lastFrame } = render(<Wrapper />);
    expect(lastFrame()).toContain('"isRunning":true');
    expect(lastFrame()).toContain('"port":3333');
  });

  it('updates when apiServer emits change', async () => {
    const { lastFrame } = render(<Wrapper />);
    expect(lastFrame()).toContain('"isRunning":false');

    mockApiServer.isRunning = true;
    mockApiServer.port = 4444;
    mockApiServer.emit('change');

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"isRunning":true');
    });
  });

  it('removes listener on unmount', () => {
    const { unmount } = render(<Wrapper />);
    const listenersBefore = mockApiServer.listenerCount('change');
    unmount();
    expect(mockApiServer.listenerCount('change')).toBeLessThan(listenersBefore);
  });
});
