import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ClientConfig } from './config.types.js';
import { DEFAULT_CLIENT_CONFIG } from './config.types.js';

const CONFIG_DIR = join(homedir(), '.local-llm-client');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

let cachedConfig: ClientConfig | null = null;

export async function loadConfig(): Promise<ClientConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    cachedConfig = {
      ...DEFAULT_CLIENT_CONFIG,
      ...(JSON.parse(raw) as Partial<ClientConfig>),
    };
  } catch {
    cachedConfig = { ...DEFAULT_CLIENT_CONFIG };
  }
  return cachedConfig;
}

export function getConfig(): ClientConfig {
  if (!cachedConfig) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return cachedConfig;
}

export async function saveConfig(config: ClientConfig): Promise<void> {
  cachedConfig = config;
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function setConfigValue(
  key: keyof ClientConfig,
  value: string,
): Promise<void> {
  const config = await loadConfig();
  (config as unknown as Record<string, string>)[key] = value;
  await saveConfig(config);
}
