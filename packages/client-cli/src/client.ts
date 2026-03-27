export interface ApiModelConfig {
  name: string;
  alias?: string;
}

export interface ApiModel {
  filename: string;
  configs: ApiModelConfig[];
}

export interface ApiModelsResponse {
  models: ApiModel[];
}

export interface ApiStartResponse {
  success: boolean;
  port: number;
  pid: number;
}

export interface ApiStatusResponse {
  running: boolean;
  modelFile: string | null;
  configName: string | null;
  port: number | null;
  pid: number | null;
  uptimeSeconds: number;
  error: string | null;
}

export interface ApiStopResponse {
  success: boolean;
}

export interface ApiErrorResponse {
  error: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    if (
      err instanceof Error &&
      (err.message.includes('ECONNREFUSED') ||
        err.message.includes('fetch failed'))
    ) {
      throw new Error(
        `Cannot reach server. Is the API server running at ${url.split('/api')[0]}?`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T | ApiErrorResponse;
  if (!res.ok) {
    throw new Error((body as ApiErrorResponse).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function listModels(baseUrl: string): Promise<ApiModelsResponse> {
  const res = await fetchWithTimeout(`${baseUrl}/api/models`);
  return parseJson<ApiModelsResponse>(res);
}

export async function startModel(
  baseUrl: string,
  filename: string,
  config?: string,
): Promise<ApiStartResponse> {
  const res = await fetchWithTimeout(
    `${baseUrl}/api/models/${encodeURIComponent(filename)}/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: config ?? 'default' }),
    },
  );
  return parseJson<ApiStartResponse>(res);
}

export async function getStatus(baseUrl: string): Promise<ApiStatusResponse> {
  const res = await fetchWithTimeout(`${baseUrl}/api/status`);
  return parseJson<ApiStatusResponse>(res);
}

export async function stopModel(baseUrl: string): Promise<ApiStopResponse> {
  const res = await fetchWithTimeout(`${baseUrl}/api/stop`, { method: 'POST' });
  return parseJson<ApiStopResponse>(res);
}
