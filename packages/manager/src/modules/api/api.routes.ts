import type { IncomingMessage, ServerResponse } from 'node:http';
import { configService } from '../config/config.service.js';
import { serverManager } from '../server/server-manager.js';
import type {
  ApiModelsResponse,
  ApiModelConfig,
  ApiStartBody,
  ApiStartResponse,
  ApiStatusResponse,
  ApiStopResponse,
  ApiErrorResponse,
} from './api.types.js';

type JsonResponse =
  | ApiModelsResponse
  | ApiStartResponse
  | ApiStatusResponse
  | ApiStopResponse
  | ApiErrorResponse;

function sendJson(
  res: ServerResponse,
  status: number,
  body: JsonResponse,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

const START_ROUTE = /^\/api\/models\/([^/]+)\/start$/;

async function handleStartModel(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<void> {
  const match = START_ROUTE.exec(pathname);
  if (!match) {
    sendJson(res, 404, { error: 'Not found' } satisfies ApiErrorResponse);
    return;
  }
  const identifier = decodeURIComponent(match[1] ?? '');

  const resolved = configService.resolveModelIdentifier(identifier);
  if (!resolved) {
    sendJson(res, 404, {
      error: `No configuration found for model: ${identifier}`,
    } satisfies ApiErrorResponse);
    return;
  }
  const { filename } = resolved;
  const configurations = configService.get().configurations;

  let body: ApiStartBody = {};
  try {
    const raw = await readBody(req);
    if (raw.trim()) {
      body = JSON.parse(raw) as ApiStartBody;
    }
  } catch {
    sendJson(res, 400, {
      error: 'Invalid JSON body',
    } satisfies ApiErrorResponse);
    return;
  }

  const configName =
    typeof body.config === 'string' && body.config.trim()
      ? body.config.trim()
      : 'default';

  if (!Object.hasOwn(configurations[filename] ?? {}, configName)) {
    sendJson(res, 404, {
      error: `No configuration named "${configName}" for model: ${filename}`,
    } satisfies ApiErrorResponse);
    return;
  }

  const modelsDir = configService.getModelsDirectory();
  const modelPath = `${modelsDir}/${filename}`;
  const launchConfig = configService.getEffective(
    filename,
    modelPath,
    configName,
  );

  await serverManager.start(launchConfig, filename, configName);

  const state = serverManager.getState();
  sendJson(res, 200, {
    success: true,
    port: state.port ?? launchConfig.port,
    pid: state.pid ?? 0,
  } satisfies ApiStartResponse);
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { method, url } = req;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const pathname = url?.split('?')[0] ?? '';

  // GET /api/models
  if (method === 'GET' && pathname === '/api/models') {
    const configurations = configService.get().configurations;
    const models: ApiModelsResponse['models'] = Object.entries(
      configurations,
    ).map(([filename, configs]) => {
      const configEntries: ApiModelConfig[] = Object.entries(configs).map(
        ([name, cfg]) => ({
          name,
          ...(cfg.alias ? { alias: cfg.alias } : {}),
        }),
      );
      return { filename, configs: configEntries };
    });
    sendJson(res, 200, { models } satisfies ApiModelsResponse);
    return;
  }

  // GET /api/status
  if (method === 'GET' && pathname === '/api/status') {
    const state = serverManager.getState();
    sendJson(res, 200, {
      running: state.running,
      modelFile: state.modelFile,
      configName: state.configName,
      port: state.port,
      pid: state.pid,
      uptimeSeconds: state.uptimeSeconds,
      error: state.error,
      logs: state.logs,
    } satisfies ApiStatusResponse);
    return;
  }

  // POST /api/stop
  if (method === 'POST' && pathname === '/api/stop') {
    serverManager.stop();
    sendJson(res, 200, { success: true } satisfies ApiStopResponse);
    return;
  }

  // POST /api/models/:identifier/start
  if (method === 'POST' && START_ROUTE.test(pathname)) {
    await handleStartModel(req, res, pathname);
    return;
  }

  sendJson(res, 404, { error: 'Not found' } satisfies ApiErrorResponse);
}
