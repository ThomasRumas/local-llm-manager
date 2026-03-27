import { describe, it, expect, vi } from 'vitest';

// ── Mock fetch ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { listModels, startModel, getStatus, stopModel } from './client.js';

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const BASE_URL = 'http://localhost:3333';

describe('Client HTTP functions', () => {
  // ── listModels() ──────────────────────────────────────────────────────────
  describe('listModels()', () => {
    it('returns model list on success', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ models: [{ filename: 'test.gguf', configs: [] }] }),
      );
      const result = await listModels(BASE_URL);
      expect(result.models).toHaveLength(1);
      expect(result.models[0].filename).toBe('test.gguf');
    });

    it('throws on HTTP error with error message from body', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ error: 'Not found' }, false, 404),
      );
      await expect(listModels(BASE_URL)).rejects.toThrow('Not found');
    });

    it('throws HTTP status string when no error field in body', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({}, false, 500));
      await expect(listModels(BASE_URL)).rejects.toThrow('HTTP 500');
    });
  });

  // ── startModel() ──────────────────────────────────────────────────────────
  describe('startModel()', () => {
    it('posts to correct URL with encoded filename', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ success: true, port: 8001, pid: 1234 }),
      );
      await startModel(BASE_URL, 'my model.gguf', 'default');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('my model.gguf')),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns port and pid on success', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ success: true, port: 8001, pid: 9999 }),
      );
      const result = await startModel(BASE_URL, 'test.gguf');
      expect(result.port).toBe(8001);
      expect(result.pid).toBe(9999);
    });
  });

  // ── getStatus() ───────────────────────────────────────────────────────────
  describe('getStatus()', () => {
    it('returns running=true when server is active', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          running: true,
          modelFile: 'test.gguf',
          configName: 'default',
          port: 8001,
          pid: 5678,
          uptimeSeconds: 120,
          error: null,
        }),
      );
      const status = await getStatus(BASE_URL);
      expect(status.running).toBe(true);
      expect(status.uptimeSeconds).toBe(120);
    });

    it('returns running=false when server is stopped', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          running: false,
          modelFile: null,
          configName: null,
          port: null,
          pid: null,
          uptimeSeconds: 0,
          error: null,
        }),
      );
      const status = await getStatus(BASE_URL);
      expect(status.running).toBe(false);
    });
  });

  // ── stopModel() ───────────────────────────────────────────────────────────
  describe('stopModel()', () => {
    it('returns success=true on stop', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ success: true }));
      const result = await stopModel(BASE_URL);
      expect(result.success).toBe(true);
    });
  });

  // ── timeout handling ──────────────────────────────────────────────────────
  describe('timeout / connection error handling', () => {
    it('throws "timed out" on AbortError', async () => {
      mockFetch.mockRejectedValueOnce(
        Object.assign(new Error('Aborted'), { name: 'AbortError' }),
      );
      await expect(listModels(BASE_URL)).rejects.toThrow('timed out');
    });

    it('throws "Cannot reach server" on ECONNREFUSED', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(listModels(BASE_URL)).rejects.toThrow('Cannot reach server');
    });

    it('throws "Cannot reach server" on fetch failed', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
      await expect(listModels(BASE_URL)).rejects.toThrow('Cannot reach server');
    });

    it('re-throws other errors as-is', async () => {
      mockFetch.mockRejectedValueOnce(new Error('unexpected'));
      await expect(listModels(BASE_URL)).rejects.toThrow('unexpected');
    });
  });
});
