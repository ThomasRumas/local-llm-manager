import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';

// ── Mock dependencies ─────────────────────────────────────────────────────────
vi.mock('../config/config.service.js', () => ({
  configService: {
    get: vi.fn(),
    resolveModelIdentifier: vi.fn(),
    getEffective: vi.fn(),
    getModelsDirectory: vi.fn().mockReturnValue('/models'),
  },
}));

vi.mock('../server/server-manager.js', () => ({
  serverManager: {
    getState: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

import { handleRequest } from './api.routes.js';
import { configService } from '../config/config.service.js';
import { serverManager } from '../server/server-manager.js';

const mockConfigGet = vi.mocked(configService.get);
const mockResolve = vi.mocked(configService.resolveModelIdentifier);
const mockGetEffective = vi.mocked(configService.getEffective);
const mockGetState = vi.mocked(serverManager.getState);
const mockStop = vi.mocked(serverManager.stop);
const mockStart = vi.mocked(serverManager.start);

// ── HTTP mock helpers ─────────────────────────────────────────────────────────
function makeReq(method: string, url: string, body?: string): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage;
  (req as unknown as { method: string; url: string }).method = method;
  (req as unknown as { url: string }).url = url;

  // Emit body async so readBody promise resolves
  if (body === undefined) {
    setImmediate(() => req.emit('end'));
  } else {
    setImmediate(() => {
      req.emit('data', Buffer.from(body));
      req.emit('end');
    });
  }
  return req;
}

function makeRes() {
  const chunks: string[] = [];
  let status = 200;
  let headers: Record<string, string | number> = {};

  const res = {
    writeHead: vi.fn((s: number, h: Record<string, string | number>) => {
      status = s;
      headers = h;
    }),
    end: vi.fn((body: string) => {
      chunks.push(body);
    }),
    getStatus: () => status,
    getBody: () => {
      try { return JSON.parse(chunks.join('')); }
      catch { return chunks.join(''); }
    },
    getHeader: (key: string) => headers[key],
  } as unknown as ServerResponse & {
    getStatus: () => number;
    getBody: () => unknown;
    getHeader: (key: string) => string | number;
  };

  return res;
}

const BASE_CONFIGS = {
  'model.gguf': {
    default: { alias: 'TestModel', temp: 0.6 },
  },
};

const BASE_STATE = {
  running: false,
  modelFile: null,
  configName: null,
  port: null,
  pid: null,
  uptimeSeconds: 0,
  logs: [],
  error: null,
};

describe('handleRequest()', () => {
  beforeEach(() => {
    mockConfigGet.mockReturnValue({
      configurations: BASE_CONFIGS,
      modelsDirectory: '/models',
      defaults: { port: 8001, ctxSize: 131072 },
      apiServer: { enabled: false, port: 3333 },
    } as ReturnType<typeof configService.get>);

    mockGetState.mockReturnValue(BASE_STATE as ReturnType<typeof serverManager.getState>);

    mockGetEffective.mockReturnValue({
      modelPath: '/models/model.gguf',
      alias: 'TestModel',
      temp: 0.6, topP: 0.95, topK: 20, minP: 0,
      port: 8001, ctxSize: 131072,
      kvUnified: true, cacheTypeK: 'q8_0', cacheTypeV: 'q8_0',
      flashAttn: 'on', fit: 'on', extraFlags: '',
    });
  });

  // ── OPTIONS ───────────────────────────────────────────────────────────────
  it('handles CORS preflight OPTIONS with 204', async () => {
    const req = makeReq('OPTIONS', '/api/models');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
      'Access-Control-Allow-Origin': '*',
    }));
  });

  // ── GET /api/models ───────────────────────────────────────────────────────
  it('GET /api/models returns model list', async () => {
    const req = makeReq('GET', '/api/models');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getStatus()).toBe(200);
    const body = res.getBody() as { models: unknown[] };
    expect(body.models).toHaveLength(1);
    expect((body.models[0] as { filename: string }).filename).toBe('model.gguf');
  });

  it('GET /api/models includes alias in config entries', async () => {
    const req = makeReq('GET', '/api/models');
    const res = makeRes();
    await handleRequest(req, res);
    const body = res.getBody() as { models: Array<{ configs: Array<{ alias?: string }> }> };
    expect(body.models[0].configs[0].alias).toBe('TestModel');
  });

  // ── GET /api/status ───────────────────────────────────────────────────────
  it('GET /api/status returns server state', async () => {
    mockGetState.mockReturnValueOnce({
      ...BASE_STATE,
      running: true,
      modelFile: 'model.gguf',
      port: 8001,
      pid: 9999,
      uptimeSeconds: 60,
    } as ReturnType<typeof serverManager.getState>);

    const req = makeReq('GET', '/api/status');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getStatus()).toBe(200);
    const body = res.getBody() as { running: boolean; port: number };
    expect(body.running).toBe(true);
    expect(body.port).toBe(8001);
  });

  // ── POST /api/stop ────────────────────────────────────────────────────────
  it('POST /api/stop calls serverManager.stop and returns success', async () => {
    const req = makeReq('POST', '/api/stop');
    const res = makeRes();
    await handleRequest(req, res);
    expect(mockStop).toHaveBeenCalled();
    expect((res.getBody() as { success: boolean }).success).toBe(true);
  });

  // ── POST /api/models/:identifier/start ───────────────────────────────────
  it('POST start resolves by filename and starts server', async () => {
    mockResolve.mockReturnValueOnce({ filename: 'model.gguf' });
    mockGetState.mockReturnValueOnce({ ...BASE_STATE, running: true, pid: 1234, port: 8001 } as ReturnType<typeof serverManager.getState>);

    const req = makeReq('POST', '/api/models/model.gguf/start', '{"config":"default"}');
    const res = makeRes();
    await handleRequest(req, res);

    expect(mockStart).toHaveBeenCalled();
    expect(res.getStatus()).toBe(200);
    expect((res.getBody() as { success: boolean }).success).toBe(true);
  });

  it('POST start returns 404 when identifier not found', async () => {
    mockResolve.mockReturnValueOnce(undefined);
    const req = makeReq('POST', '/api/models/ghost.gguf/start', '');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getStatus()).toBe(404);
    expect((res.getBody() as { error: string }).error).toContain('No configuration found');
  });

  it('POST start returns 400 on invalid JSON body', async () => {
    mockResolve.mockReturnValueOnce({ filename: 'model.gguf' });
    const req = makeReq('POST', '/api/models/model.gguf/start', '{invalid json}');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getStatus()).toBe(400);
    expect((res.getBody() as { error: string }).error).toContain('Invalid JSON');
  });

  it('POST start returns 404 for unknown config name', async () => {
    mockResolve.mockReturnValueOnce({ filename: 'model.gguf' });
    const req = makeReq('POST', '/api/models/model.gguf/start', '{"config":"nonexistent"}');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getStatus()).toBe(404);
    expect((res.getBody() as { error: string }).error).toContain('nonexistent');
  });

  // ── unknown route ─────────────────────────────────────────────────────────
  it('returns 404 for unknown routes', async () => {
    const req = makeReq('GET', '/unknown');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getStatus()).toBe(404);
  });

  // ── CORS headers ─────────────────────────────────────────────────────────
  it('includes CORS headers on all JSON responses', async () => {
    const req = makeReq('GET', '/api/status');
    const res = makeRes();
    await handleRequest(req, res);
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
  });
});
