import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { ApiStatusResponse } from './api.types.js';

// ── Mock node:http ────────────────────────────────────────────────────────────
vi.mock('node:http', () => ({
  request: vi.fn(),
}));

import { request } from 'node:http';
import { fetchDaemonStatus, sendDaemonStop } from './api.client.js';

const mockRequest = vi.mocked(request);

// ── HTTP mock helpers ─────────────────────────────────────────────────────────

/**
 * Build a minimal fake ClientRequest.
 * - `timeout: true`  → setTimeout callback fires immediately (simulates timeout)
 * - `error`          → emits 'error' on the next tick
 */
function makeFakeReq(opts: { timeout?: boolean; error?: Error } = {}) {
  const emitter = new EventEmitter();
  const req = Object.assign(emitter, {
    setTimeout: vi.fn((_ms: number, cb: () => void) => {
      if (opts.timeout) setImmediate(cb);
    }),
    destroy: vi.fn(),
    end: vi.fn(),
  });
  if (opts.error) {
    const err = opts.error;
    setImmediate(() => emitter.emit('error', err));
  }
  return req as unknown as ClientRequest;
}

/**
 * Build a fake IncomingMessage (no body scheduling — see stubResponse).
 */
function makeFakeRes(statusCode: number) {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    statusCode,
    resume: vi.fn(),
  });
  return res as unknown as IncomingMessage;
}

/** Stub `request()` to return an immediate HTTP response. */
function stubResponse(statusCode: number, body?: string) {
  mockRequest.mockImplementation((_opts, cb) => {
    const req = makeFakeReq();
    const res = makeFakeRes(statusCode);
    setImmediate(() => {
      // Call the response callback first so it can register data/end listeners
      (cb as (res: IncomingMessage) => void)(res);
      // Then emit body events synchronously (listeners are now attached)
      if (body !== undefined) {
        res.emit('data', Buffer.from(body));
        res.emit('end');
      }
    });
    return req;
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STATUS_RESPONSE: ApiStatusResponse = {
  running: true,
  modelFile: 'model.gguf',
  configName: 'default',
  port: 8001,
  pid: 1234,
  uptimeSeconds: 30,
  error: null,
  logs: ['[info] Server started', '[info] listening on 8001'],
};

// ── fetchDaemonStatus() ───────────────────────────────────────────────────────

describe('fetchDaemonStatus()', () => {
  it('returns parsed ApiStatusResponse on 200', async () => {
    stubResponse(200, JSON.stringify(STATUS_RESPONSE));
    const result = await fetchDaemonStatus(3333);
    expect(result).toEqual(STATUS_RESPONSE);
  });

  it('includes logs array in the parsed response', async () => {
    stubResponse(200, JSON.stringify(STATUS_RESPONSE));
    const result = await fetchDaemonStatus(3333);
    expect(result?.logs).toEqual([
      '[info] Server started',
      '[info] listening on 8001',
    ]);
  });

  it('returns null on non-200 status', async () => {
    stubResponse(500);
    const result = await fetchDaemonStatus(3333);
    expect(result).toBeNull();
  });

  it('returns null on connection error', async () => {
    mockRequest.mockImplementation(() =>
      makeFakeReq({ error: new Error('ECONNREFUSED') }),
    );
    const result = await fetchDaemonStatus(3333);
    expect(result).toBeNull();
  });

  it('returns null on request timeout', async () => {
    mockRequest.mockImplementation(() => makeFakeReq({ timeout: true }));
    const result = await fetchDaemonStatus(3333);
    expect(result).toBeNull();
  });

  it('returns null on invalid JSON body', async () => {
    stubResponse(200, 'not-valid-json{{');
    const result = await fetchDaemonStatus(3333);
    expect(result).toBeNull();
  });

  it('returns null when response emits error', async () => {
    mockRequest.mockImplementation((_opts, cb) => {
      const req = makeFakeReq();
      const res = makeFakeRes(200); // 200 but res will error
      setImmediate(() => {
        (cb as (res: IncomingMessage) => void)(res);
        // Error fires before data/end complete
        setImmediate(() => res.emit('error', new Error('socket hang up')));
      });
      return req;
    });
    const result = await fetchDaemonStatus(3333);
    expect(result).toBeNull();
  });

  it('calls request with correct hostname and path', async () => {
    stubResponse(200, JSON.stringify(STATUS_RESPONSE));
    await fetchDaemonStatus(4444);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '127.0.0.1',
        port: 4444,
        path: '/api/status',
        method: 'GET',
      }),
      expect.any(Function),
    );
  });

  it('sets a timeout on the request', async () => {
    let capturedReq: ReturnType<typeof makeFakeReq> | null = null;
    mockRequest.mockImplementation((_opts, cb) => {
      const req = makeFakeReq();
      capturedReq = req as unknown as ReturnType<typeof makeFakeReq>;
      const res = makeFakeRes(200);
      setImmediate(() => {
        (cb as (res: IncomingMessage) => void)(res);
        res.emit('data', Buffer.from(JSON.stringify(STATUS_RESPONSE)));
        res.emit('end');
      });
      return req;
    });
    await fetchDaemonStatus(3333);
    expect(
      (capturedReq as unknown as { setTimeout: ReturnType<typeof vi.fn> })
        .setTimeout,
    ).toHaveBeenCalledWith(expect.any(Number), expect.any(Function));
  });

  it('destroys the request on timeout', async () => {
    let capturedReq: ReturnType<typeof makeFakeReq> | null = null;
    mockRequest.mockImplementation(() => {
      const req = makeFakeReq({ timeout: true });
      capturedReq = req as unknown as ReturnType<typeof makeFakeReq>;
      return req;
    });
    await fetchDaemonStatus(3333);
    expect(
      (capturedReq as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy,
    ).toHaveBeenCalled();
  });
});

// ── sendDaemonStop() ──────────────────────────────────────────────────────────

describe('sendDaemonStop()', () => {
  it('returns true on 200 response', async () => {
    stubResponse(200);
    const result = await sendDaemonStop(3333);
    expect(result).toBe(true);
  });

  it('returns false on non-200 response', async () => {
    stubResponse(500);
    const result = await sendDaemonStop(3333);
    expect(result).toBe(false);
  });

  it('returns false on connection error', async () => {
    mockRequest.mockImplementation(() =>
      makeFakeReq({ error: new Error('ECONNREFUSED') }),
    );
    const result = await sendDaemonStop(3333);
    expect(result).toBe(false);
  });

  it('returns false on timeout', async () => {
    mockRequest.mockImplementation(() => makeFakeReq({ timeout: true }));
    const result = await sendDaemonStop(3333);
    expect(result).toBe(false);
  });

  it('calls request with POST method and /api/stop path', async () => {
    stubResponse(200);
    await sendDaemonStop(3333);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '127.0.0.1',
        port: 3333,
        path: '/api/stop',
        method: 'POST',
      }),
      expect.any(Function),
    );
  });
});
