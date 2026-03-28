import { createServer, type Server } from 'node:http';
import { EventEmitter } from 'node:events';
import { handleRequest } from './api.routes.js';

export class ApiServer extends EventEmitter {
  private server: Server | null = null;
  private _port: number | null = null;

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve();
        return;
      }
      const server = createServer((req, res) => {
        handleRequest(req, res).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        });
      });

      server.on('error', reject);
      server.listen(port, '0.0.0.0', () => {
        this.server = server;
        this._port = port;
        this.emit('change');
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.server = null;
        this._port = null;
        this.emit('change');
        resolve();
      });
    });
  }

  get isRunning(): boolean {
    return this.server !== null;
  }

  get port(): number | null {
    return this._port;
  }
}

export const apiServer = new ApiServer();
