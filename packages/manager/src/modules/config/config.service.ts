import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type AppConfig,
  type ApiServerConfig,
  type ModelConfig,
  type ResolvedConfig,
  DEFAULT_CONFIG,
  DEFAULT_API_SERVER,
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
      this.config = {
        ...DEFAULT_CONFIG,
        ...parsed,
        apiServer: { ...DEFAULT_API_SERVER, ...parsed.apiServer },
      };
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  async save(config?: AppConfig): Promise<void> {
    if (config) {
      this.config = config;
    }
    if (!this.config) {
      throw new Error('No config loaded');
    }
    await mkdir(this.configDir, { recursive: true });
    await writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8',
    );
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
    return (
      this.get().hfToken ||
      process.env['HF_TOKEN'] ||
      process.env['HUGGING_FACE_HUB_TOKEN']
    );
  }

  async setHfToken(token: string): Promise<void> {
    this.get().hfToken = token || undefined;
    await this.save();
  }

  getApiServerConfig(): ApiServerConfig {
    return this.get().apiServer;
  }

  async setApiServerConfig(config: Partial<ApiServerConfig>): Promise<void> {
    Object.assign(this.get().apiServer, config);
    await this.save();
  }

  getModelConfig(
    modelFile: string,
    configName: string = 'default',
  ): ModelConfig | undefined {
    return this.get().configurations[modelFile]?.[configName];
  }

  /**
   * Find a model+config pair by alias. Returns the first match.
   * Returns undefined if no config has a matching alias.
   */
  findByAlias(
    alias: string,
  ): { filename: string; configName: string } | undefined {
    const configurations = this.get().configurations;
    for (const [filename, configs] of Object.entries(configurations)) {
      for (const [configName, modelConfig] of Object.entries(configs)) {
        if (modelConfig.alias && modelConfig.alias === alias) {
          return { filename, configName };
        }
      }
    }
    return undefined;
  }

  /**
   * Resolve an identifier (alias, filename with or without .gguf) to a filename
   * that exists in configurations. Returns undefined if not found.
   */
  resolveModelIdentifier(identifier: string): { filename: string } | undefined {
    const configurations = this.get().configurations;
    // 1. Exact filename match
    if (Object.hasOwn(configurations, identifier)) {
      return { filename: identifier };
    }
    // 2. Filename + .gguf
    const withExt = identifier.endsWith('.gguf')
      ? identifier
      : `${identifier}.gguf`;
    if (Object.hasOwn(configurations, withExt)) {
      return { filename: withExt };
    }
    // 3. Alias match
    const byAlias = this.findByAlias(identifier);
    if (byAlias) {
      return { filename: byAlias.filename };
    }
    return undefined;
  }

  getModelConfigNames(modelFile: string): string[] {
    const configs = this.get().configurations[modelFile];
    return configs ? Object.keys(configs) : [];
  }

  /**
   * Returns the alias for a given model + config, or the stripped filename
   * as a fallback so callers never have to deal with ".gguf" themselves.
   */
  getModelDisplayName(
    modelFile: string,
    configName: string = 'default',
  ): string {
    const alias = this.getModelConfig(modelFile, configName)?.alias;
    if (alias?.trim()) return alias.trim();
    // Try any config if the requested one has no alias
    const configs = this.get().configurations[modelFile];
    if (configs) {
      for (const cfg of Object.values(configs)) {
        if (cfg.alias?.trim()) return cfg.alias.trim();
      }
    }
    return modelFile.replace(/\.gguf$/, '');
  }

  async saveModelConfig(
    modelFile: string,
    configName: string,
    config: ModelConfig,
  ): Promise<void> {
    const appConfig = this.get();
    if (!appConfig.configurations[modelFile]) {
      appConfig.configurations[modelFile] = {};
    }
    appConfig.configurations[modelFile][configName] = config;
    await this.save();
  }

  async deleteModelConfig(
    modelFile: string,
    configName?: string,
  ): Promise<void> {
    const appConfig = this.get();
    if (configName) {
      delete appConfig.configurations[modelFile]?.[configName];
      if (
        appConfig.configurations[modelFile] &&
        Object.keys(appConfig.configurations[modelFile]).length === 0
      ) {
        delete appConfig.configurations[modelFile];
      }
    } else {
      delete appConfig.configurations[modelFile];
    }
    await this.save();
  }

  getEffective(
    modelFile: string,
    modelPath: string,
    configName: string = 'default',
  ): ResolvedConfig {
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
      ctxSize:
        modelConfig.ctxSize ?? defaults.ctxSize ?? HARDCODED_DEFAULTS.ctxSize,
      host: modelConfig.host ?? defaults.host ?? HARDCODED_DEFAULTS.host,
      kvUnified: modelConfig.kvUnified ?? HARDCODED_DEFAULTS.kvUnified,
      cacheTypeK: modelConfig.cacheTypeK ?? HARDCODED_DEFAULTS.cacheTypeK,
      cacheTypeV: modelConfig.cacheTypeV ?? HARDCODED_DEFAULTS.cacheTypeV,
      flashAttn: modelConfig.flashAttn ?? HARDCODED_DEFAULTS.flashAttn,
      fit: modelConfig.fit ?? HARDCODED_DEFAULTS.fit,
      extraFlags: modelConfig.extraFlags ?? HARDCODED_DEFAULTS.extraFlags,
      gpuLayers: modelConfig.gpuLayers ?? HARDCODED_DEFAULTS.gpuLayers,
    };
  }
}

export const configService = new ConfigService();
