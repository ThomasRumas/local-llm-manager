import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock http module ──────────────────────────────────────────────────────────
vi.mock('./api.routes.js', () => ({
  handleRequest: vi.fn().mockResolvedValue(undefined),
}));

const mockListen = vi.fn();
const mockClose = vi.fn();
const mockServerOn = vi.fn();

vi.mock('node:http', () => ({
  createServer: vi.fn(() => ({
    on: mockServerOn,
    listen: mockListen,
    close: mockClose,
  })),
}));

import { createServer } from 'node:http';
import { ApiServer } from './api.server.js';

const mockCreateServer = vi.mocked(createServer);

describe('ApiServer', () => {
  let server: ApiServer;

  beforeEach(() => {
    server = new ApiServer();
  });

  // ── start() ───────────────────────────────────────────────────────────────
  describe('start()', () => {
    it('creates an HTTP server and listens on port', async () => {
      mockListen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb(),
      );
      mockServerOn.mockImplementation(() => ({}));

      await server.start(3333);
      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockListen).toHaveBeenCalledWith(
        3333,
        '0.0.0.0',
        expect.any(Function),
      );
    });

    it('emits change after listening', async () => {
      mockListen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb(),
      );
      mockServerOn.mockImplementation(() => ({}));

      const onChange = vi.fn();
      server.on('change', onChange);
      await server.start(3333);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('sets isRunning=true and port after listen', async () => {
      mockListen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb(),
      );
      mockServerOn.mockImplementation(() => ({}));

      await server.start(3333);
      expect(server.isRunning).toBe(true);
      expect(server.port).toBe(3333);
    });

    it('resolves immediately if already running (idempotent)', async () => {
      mockListen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb(),
      );
      mockServerOn.mockImplementation(() => ({}));

      await server.start(3333);
      await server.start(9999); // second call should no-op
      expect(mockListen).toHaveBeenCalledTimes(1);
    });

    it('rejects on server error', async () => {
      mockServerOn.mockImplementation(
        (event: string, handler: (err: Error) => void) => {
          if (event === 'error') {
            setImmediate(() => handler(new Error('EADDRINUSE')));
          }
        },
      );
      mockListen.mockImplementation(() => {});

      await expect(server.start(3333)).rejects.toThrow('EADDRINUSE');
    });
  });

  // ── stop() ────────────────────────────────────────────────────────────────
  describe('stop()', () => {
    it('resolves immediately if not running', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('emits change after close', async () => {
      mockListen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb(),
      );
      mockServerOn.mockImplementation(() => ({}));
      mockClose.mockImplementation((cb: () => void) => cb());

      await server.start(3333);
      const onChange = vi.fn();
      server.on('change', onChange);
      await server.stop();
      expect(onChange).toHaveBeenCalled();
    });

    it('sets isRunning=false after stop', async () => {
      mockListen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb(),
      );
      mockServerOn.mockImplementation(() => ({}));
      mockClose.mockImplementation((cb: () => void) => cb());

      await server.start(3333);
      await server.stop();
      expect(server.isRunning).toBe(false);
      expect(server.port).toBeNull();
    });
  });

  // ── getters ───────────────────────────────────────────────────────────────
  describe('getters', () => {
    it('isRunning is false initially', () => {
      expect(server.isRunning).toBe(false);
    });

    it('port is null initially', () => {
      expect(server.port).toBeNull();
    });
  });
});
