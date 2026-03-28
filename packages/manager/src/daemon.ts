#!/usr/bin/env node
import { configService } from './modules/config/config.service.js';
import { apiServer } from './modules/api/api.server.js';
import { serverManager } from './modules/server/server-manager.js';
import {
  writePid,
  removePid,
  checkExistingDaemon,
} from './modules/daemon/pid-file.js';

async function shutdown(signal: string): Promise<never> {
  console.log(`[daemon] Received ${signal}, shutting down...`);
  serverManager.stop();
  await apiServer.stop();
  await removePid();
  console.log('[daemon] Stopped.');
  process.exit(0);
}

async function start(): Promise<void> {
  const existing = await checkExistingDaemon();
  if (existing.running) {
    console.error(
      `[daemon] Already running with PID ${existing.pid}. Use 'llm-client service stop' to stop it first.`,
    );
    process.exit(1);
  }

  const config = await configService.load();

  await writePid(process.pid);

  // In daemon mode the API server is always enabled regardless of the
  // apiServer.enabled flag in config (the daemon IS the API server).
  const port = config.apiServer.port;
  await apiServer.start(port);

  console.log(
    `[daemon] Started. PID=${process.pid} API port=${port}`,
  );

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await start();
