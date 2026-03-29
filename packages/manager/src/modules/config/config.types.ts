export type CacheType =
  | 'f16'
  | 'f32'
  | 'q8_0'
  | 'q4_0'
  | 'q4_1'
  | 'q5_0'
  | 'q5_1'
  | 'iq4_nl'; // Not supported by llama.cpp, only for ik_llama.cpp
export type OnOffSetting = 'on' | 'off';

export interface Defaults {
  port: number;
  ctxSize: number;
  host: string;
  isIkLlama: boolean;
}

export interface ModelConfig {
  alias?: string;
  temp?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  port?: number;
  ctxSize?: number;
  host?: string;
  kvUnified?: boolean;
  cacheTypeK?: CacheType;
  cacheTypeV?: CacheType;
  flashAttn?: OnOffSetting;
  fit?: OnOffSetting;
  extraFlags?: string;
  gpuLayers?: number;
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
  host: string;
  kvUnified: boolean;
  cacheTypeK: CacheType;
  cacheTypeV: CacheType;
  flashAttn: OnOffSetting;
  fit: OnOffSetting;
  extraFlags: string;
  gpuLayers: number;
}

export const HARDCODED_DEFAULTS: Required<
  Omit<ModelConfig, 'port' | 'ctxSize' | 'host'>
> &
  Pick<Defaults, 'port' | 'ctxSize' | 'host'> = {
  alias: '',
  temp: 0.6,
  topP: 0.95,
  topK: 20,
  minP: 0,
  port: 8001,
  ctxSize: 131072,
  host: '0.0.0.0',
  kvUnified: false, //Not working with ik_llama.cpp, user need to set it manually if they want to use it with models that support it
  cacheTypeK: 'q8_0',
  cacheTypeV: 'q8_0',
  flashAttn: 'on',
  fit: 'on',
  gpuLayers: 999, // A very high number to indicate "use GPU for all layers that can fit", since the actual number of GPU layers that can fit will depend on the model and GPU VRAM, and we don't want to set an arbitrary limit that might be too low for some users
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
    host: HARDCODED_DEFAULTS.host,
    isIkLlama: false,
  },
  apiServer: { ...DEFAULT_API_SERVER },
  configurations: {},
};

export const CONFIG_DIR = '~/.local-llm-manager';
export const CONFIG_FILE = 'config.json';
