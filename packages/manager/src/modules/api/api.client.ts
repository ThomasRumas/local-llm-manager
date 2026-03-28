import { request } from 'node:http';
import type { ApiStatusResponse } from './api.types.js';

const TIMEOUT_MS = 3000;

/**
 * Fetch `GET /api/status` from the daemon running on `port`.
 * Returns the parsed `ApiStatusResponse` on success, or `null` if the daemon
 * is not reachable (connection refused, timeout, non-200 response, etc.).
 */
export function fetchDaemonStatus(
  port: number,
): Promise<ApiStatusResponse | null> {
  return new Promise((resolve) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/status',
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume(); // discard body
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = JSON.parse(
              Buffer.concat(chunks).toString('utf-8'),
            ) as ApiStatusResponse;
            resolve(body);
          } catch {
            resolve(null);
          }
        });
        res.on('error', () => resolve(null));
      },
    );

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve(null);
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Send `POST /api/stop` to the daemon running on `port`.
 * Returns `true` on success, `false` if the request fails.
 */
export function sendDaemonStop(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/stop',
        method: 'POST',
        headers: { 'Content-Length': 0 },
      },
      (res) => {
        res.resume(); // discard body
        resolve(res.statusCode === 200);
      },
    );

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve(false);
    });

    req.on('error', () => resolve(false));
    req.end();
  });
}
