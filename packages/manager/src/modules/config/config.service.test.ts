import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from './config.service.js';
import { HARDCODED_DEFAULTS, DEFAULT_CONFIG } from './config.types.js';

// ── fs/promises mock ─────────────────────────────────────────────────────────
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:os', () => ({
  homedir: () => '/home/testuser',
}));

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

function makeService() {
  return new ConfigService();
}

const VALID_CONFIG = JSON.stringify({
  modelsDirectory: '/custom/models',
  defaults: { port: 9000, ctxSize: 65536 },
  apiServer: { enabled: true, port: 4444 },
  configurations: {
    'mymodel.gguf': {
      default: { alias: 'MyAlias', temp: 0.7 },
    },
  },
});

// ── load() ───────────────────────────────────────────────────────────────────
describe('ConfigService.load()', () => {
  it('parses a valid config file and merges with defaults', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    const config = await svc.load();

    expect(config.modelsDirectory).toBe('/custom/models');
    expect(config.defaults.port).toBe(9000);
    expect(config.apiServer.enabled).toBe(true);
    expect(config.apiServer.port).toBe(4444);
  });

  it('falls back to DEFAULT_CONFIG when file is missing (ENOENT)', async () => {
    mockReadFile.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const svc = makeService();
    const config = await svc.load();

    expect(config.modelsDirectory).toBe(DEFAULT_CONFIG.modelsDirectory);
    expect(config.configurations).toEqual({});
  });

  it('falls back to DEFAULT_CONFIG on invalid JSON', async () => {
    mockReadFile.mockResolvedValueOnce('{not valid json}');
    const svc = makeService();
    const config = await svc.load();

    expect(config).toMatchObject(DEFAULT_CONFIG);
  });

  it('merges apiServer with DEFAULT_API_SERVER if fields are missing', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ apiServer: { enabled: true } }));
    const svc = makeService();
    const config = await svc.load();

    expect(config.apiServer.enabled).toBe(true);
    expect(config.apiServer.port).toBe(3333); // from DEFAULT_API_SERVER
  });
});

// ── get() before load() ──────────────────────────────────────────────────────
describe('ConfigService.get()', () => {
  it('throws if called before load()', () => {
    const svc = makeService();
    expect(() => svc.get()).toThrow('Config not loaded');
  });

  it('returns loaded config after load()', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.get().modelsDirectory).toBe('/custom/models');
  });
});

// ── save() ───────────────────────────────────────────────────────────────────
describe('ConfigService.save()', () => {
  it('throws if called without prior load()', async () => {
    const svc = makeService();
    await expect(svc.save()).rejects.toThrow('No config loaded');
  });

  it('writes JSON with 2-space indentation', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    await svc.save();

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('.local-llm-manager'),
      { recursive: true },
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^\{/), // valid JSON
      'utf-8',
    );
    const written = JSON.parse((mockWriteFile.mock.calls[0]![1] as string));
    expect(written.modelsDirectory).toBe('/custom/models');
  });
});

// ── getModelsDirectory() ─────────────────────────────────────────────────────
describe('ConfigService.getModelsDirectory()', () => {
  it('expands ~ to homedir', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    const dir = svc.getModelsDirectory();
    expect(dir).toBe('/home/testuser/.local-llm-manager/models');
  });

  it('returns absolute path as-is', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ modelsDirectory: '/abs/path' }),
    );
    const svc = makeService();
    await svc.load();
    expect(svc.getModelsDirectory()).toBe('/abs/path');
  });
});

// ── getEffective() ───────────────────────────────────────────────────────────
describe('ConfigService.getEffective()', () => {
  it('uses model config values over global defaults', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    const effective = svc.getEffective('mymodel.gguf', '/models/mymodel.gguf', 'default');

    expect(effective.alias).toBe('MyAlias');
    expect(effective.temp).toBe(0.7); // from model config
    expect(effective.port).toBe(9000); // from global defaults
    expect(effective.ctxSize).toBe(65536); // from global defaults
  });

  it('falls back to HARDCODED_DEFAULTS when nothing is set', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    const effective = svc.getEffective('unknown.gguf', '/models/unknown.gguf');

    expect(effective.temp).toBe(HARDCODED_DEFAULTS.temp);
    expect(effective.port).toBe(HARDCODED_DEFAULTS.port);
    expect(effective.kvUnified).toBe(HARDCODED_DEFAULTS.kvUnified);
  });
});

// ── findByAlias() ────────────────────────────────────────────────────────────
describe('ConfigService.findByAlias()', () => {
  it('finds a model by alias', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    const result = svc.findByAlias('MyAlias');

    expect(result).toEqual({ filename: 'mymodel.gguf', configName: 'default' });
  });

  it('returns undefined when alias does not exist', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.findByAlias('NonExistentAlias')).toBeUndefined();
  });

  it('returns undefined when configurations is empty', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    expect(svc.findByAlias('anything')).toBeUndefined();
  });
});

// ── resolveModelIdentifier() ─────────────────────────────────────────────────
describe('ConfigService.resolveModelIdentifier()', () => {
  it('resolves exact filename', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.resolveModelIdentifier('mymodel.gguf')).toEqual({ filename: 'mymodel.gguf' });
  });

  it('resolves name without .gguf extension', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.resolveModelIdentifier('mymodel')).toEqual({ filename: 'mymodel.gguf' });
  });

  it('resolves by alias', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.resolveModelIdentifier('MyAlias')).toEqual({ filename: 'mymodel.gguf' });
  });

  it('returns undefined for unknown identifier', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.resolveModelIdentifier('doesnotexist')).toBeUndefined();
  });
});

// ── getModelDisplayName() ────────────────────────────────────────────────────
describe('ConfigService.getModelDisplayName()', () => {
  it('returns alias when available', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.getModelDisplayName('mymodel.gguf', 'default')).toBe('MyAlias');
  });

  it('falls back to filename without .gguf when no alias', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    expect(svc.getModelDisplayName('somemodel.gguf')).toBe('somemodel');
  });

  it('finds alias from any config when requested configName has no alias', async () => {
    const multiConfig = JSON.stringify({
      configurations: {
        'm.gguf': {
          default: { temp: 0.5 },
          quality: { alias: 'QualityAlias', temp: 0.3 },
        },
      },
    });
    mockReadFile.mockResolvedValueOnce(multiConfig);
    const svc = makeService();
    await svc.load();
    expect(svc.getModelDisplayName('m.gguf', 'default')).toBe('QualityAlias');
  });
});

// ── saveModelConfig() / getModelConfigNames() / deleteModelConfig() ──────────
describe('ConfigService.saveModelConfig() / getModelConfigNames() / deleteModelConfig()', () => {
  it('saves a new config and retrieves its name', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    await svc.saveModelConfig('new.gguf', 'fast', { temp: 0.4 });
    expect(svc.getModelConfigNames('new.gguf')).toContain('fast');
  });

  it('returns empty array for unknown model', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    expect(svc.getModelConfigNames('missing.gguf')).toEqual([]);
  });

  it('deletes a specific config name', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    await svc.deleteModelConfig('mymodel.gguf', 'default');
    expect(svc.getModelConfigNames('mymodel.gguf')).toEqual([]);
  });

  it('deletes all configs for a model', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    await svc.deleteModelConfig('mymodel.gguf');
    expect(svc.get().configurations['mymodel.gguf']).toBeUndefined();
  });
});

// ── getApiServerConfig() / setApiServerConfig() ──────────────────────────────
describe('ConfigService.getApiServerConfig() / setApiServerConfig()', () => {
  it('returns api server config', async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    const svc = makeService();
    await svc.load();
    expect(svc.getApiServerConfig()).toEqual({ enabled: true, port: 4444 });
  });

  it('updates api server config', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const svc = makeService();
    await svc.load();
    await svc.setApiServerConfig({ enabled: true, port: 5555 });
    expect(svc.getApiServerConfig().enabled).toBe(true);
    expect(svc.getApiServerConfig().port).toBe(5555);
  });
});
