export interface Defaults {
  port: number;
  ctxSize: number;
}

export interface ModelConfig {
  alias?: string;
  temp?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  port?: number;
  ctxSize?: number;
  kvUnified?: boolean;
  cacheTypeK?: string;
  cacheTypeV?: string;
  flashAttn?: string;
  fit?: string;
  extraFlags?: string;
}

export interface ApiServerConfig {
  enabled: boolean;
  port: number;
}

export interface AppConfig {
  modelsDirectory: string;
  hfToken?: string;
  defaults: Defaults;
  apiServer: ApiServerConfig;
  configurations: Record<string, Record<string, ModelConfig>>;
}

export interface ResolvedConfig {
  modelPath: string;
  alias: string;
  temp: number;
  topP: number;
  topK: number;
  minP: number;
  port: number;
  ctxSize: number;
  kvUnified: boolean;
  cacheTypeK: string;
  cacheTypeV: string;
  flashAttn: string;
  fit: string;
  extraFlags: string;
}

export const HARDCODED_DEFAULTS: Required<Omit<ModelConfig, 'port' | 'ctxSize'>> & Pick<Defaults, 'port' | 'ctxSize'> = {
  alias: '',
  temp: 0.6,
  topP: 0.95,
  topK: 20,
  minP: 0,
  port: 8001,
  ctxSize: 131072,
  kvUnified: true,
  cacheTypeK: 'q8_0',
  cacheTypeV: 'q8_0',
  flashAttn: 'on',
  fit: 'on',
  extraFlags: '',
};

export const DEFAULT_API_SERVER: ApiServerConfig = {
  enabled: false,
  port: 3333,
};

export const DEFAULT_CONFIG: AppConfig = {
  modelsDirectory: '~/.local-llm-manager/models',
  defaults: {
    port: HARDCODED_DEFAULTS.port,
    ctxSize: HARDCODED_DEFAULTS.ctxSize,
  },
  apiServer: { ...DEFAULT_API_SERVER },
  configurations: {},
};

export const CONFIG_DIR = '~/.local-llm-manager';
export const CONFIG_FILE = 'config.json';
