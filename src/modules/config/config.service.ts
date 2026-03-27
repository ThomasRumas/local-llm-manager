import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type AppConfig,
  type ModelConfig,
  type ResolvedConfig,
  DEFAULT_CONFIG,
  HARDCODED_DEFAULTS,
  CONFIG_DIR,
  CONFIG_FILE,
} from './config.types.js';

export class ConfigService {
  private config: AppConfig | null = null;

  private resolvePath(p: string): string {
    return p.startsWith('~') ? p.replace('~', homedir()) : p;
  }

  private get configDir(): string {
    return this.resolvePath(CONFIG_DIR);
  }

  private get configPath(): string {
    return join(this.configDir, CONFIG_FILE);
  }

  async load(): Promise<AppConfig> {
    try {
      const raw = await readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      this.config = { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config!;
  }

  async save(config?: AppConfig): Promise<void> {
    if (config) {
      this.config = config;
    }
    if (!this.config) {
      throw new Error('No config loaded');
    }
    await mkdir(this.configDir, { recursive: true });
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(): AppConfig {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  getModelsDirectory(): string {
    return this.resolvePath(this.get().modelsDirectory);
  }

  async setModelsDirectory(dir: string): Promise<void> {
    this.get().modelsDirectory = dir;
    const resolved = this.resolvePath(dir);
    await mkdir(resolved, { recursive: true });
    await this.save();
  }

  async setDefaults(defaults: Partial<AppConfig['defaults']>): Promise<void> {
    Object.assign(this.get().defaults, defaults);
    await this.save();
  }

  getHfToken(): string | undefined {
    return this.get().hfToken || process.env['HF_TOKEN'] || process.env['HUGGING_FACE_HUB_TOKEN'];
  }

  async setHfToken(token: string): Promise<void> {
    this.get().hfToken = token || undefined;
    await this.save();
  }

  getModelConfig(modelFile: string, configName: string = 'default'): ModelConfig | undefined {
    return this.get().configurations[modelFile]?.[configName];
  }

  getModelConfigNames(modelFile: string): string[] {
    const configs = this.get().configurations[modelFile];
    return configs ? Object.keys(configs) : [];
  }

  async saveModelConfig(modelFile: string, configName: string, config: ModelConfig): Promise<void> {
    const appConfig = this.get();
    if (!appConfig.configurations[modelFile]) {
      appConfig.configurations[modelFile] = {};
    }
    appConfig.configurations[modelFile][configName] = config;
    await this.save();
  }

  async deleteModelConfig(modelFile: string, configName?: string): Promise<void> {
    const appConfig = this.get();
    if (configName) {
      delete appConfig.configurations[modelFile]?.[configName];
      if (appConfig.configurations[modelFile] && Object.keys(appConfig.configurations[modelFile]).length === 0) {
        delete appConfig.configurations[modelFile];
      }
    } else {
      delete appConfig.configurations[modelFile];
    }
    await this.save();
  }

  getEffective(modelFile: string, modelPath: string, configName: string = 'default'): ResolvedConfig {
    const modelConfig = this.getModelConfig(modelFile, configName) ?? {};
    const defaults = this.get().defaults;

    return {
      modelPath,
      alias: modelConfig.alias || HARDCODED_DEFAULTS.alias || modelFile,
      temp: modelConfig.temp ?? HARDCODED_DEFAULTS.temp,
      topP: modelConfig.topP ?? HARDCODED_DEFAULTS.topP,
      topK: modelConfig.topK ?? HARDCODED_DEFAULTS.topK,
      minP: modelConfig.minP ?? HARDCODED_DEFAULTS.minP,
      port: modelConfig.port ?? defaults.port ?? HARDCODED_DEFAULTS.port,
      ctxSize: modelConfig.ctxSize ?? defaults.ctxSize ?? HARDCODED_DEFAULTS.ctxSize,
      kvUnified: modelConfig.kvUnified ?? HARDCODED_DEFAULTS.kvUnified,
      cacheTypeK: modelConfig.cacheTypeK ?? HARDCODED_DEFAULTS.cacheTypeK,
      cacheTypeV: modelConfig.cacheTypeV ?? HARDCODED_DEFAULTS.cacheTypeV,
      flashAttn: modelConfig.flashAttn ?? HARDCODED_DEFAULTS.flashAttn,
      fit: modelConfig.fit ?? HARDCODED_DEFAULTS.fit,
      extraFlags: modelConfig.extraFlags ?? HARDCODED_DEFAULTS.extraFlags,
    };
  }
}

export const configService = new ConfigService();
