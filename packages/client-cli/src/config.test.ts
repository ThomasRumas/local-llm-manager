import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:os', () => ({
  homedir: () => '/home/testuser',
}));

import { readFile, writeFile } from 'node:fs/promises';
import { loadConfig, getConfig, saveConfig, setConfigValue } from './config.js';

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

describe('Client Config', () => {
  beforeEach(async () => {
    // Reset cached config by reloading module would require dynamic import;
    // instead re-call loadConfig() in each test with different mock
  });

  describe('loadConfig()', () => {
    it('reads and merges config from disk', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          remoteUrl: 'http://192.168.1.5:3333',
          defaultModel: 'MyModel',
        }),
      );
      const config = await loadConfig();
      expect(config.remoteUrl).toBe('http://192.168.1.5:3333');
      expect(config.defaultModel).toBe('MyModel');
    });

    it('falls back to DEFAULT_CLIENT_CONFIG on read error', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
      const config = await loadConfig();
      expect(config.remoteUrl).toBe('http://localhost:3333');
    });

    it('falls back to DEFAULT_CLIENT_CONFIG on invalid JSON', async () => {
      mockReadFile.mockResolvedValueOnce('{bad json}');
      const config = await loadConfig();
      expect(config.remoteUrl).toBe('http://localhost:3333');
    });
  });

  describe('getConfig()', () => {
    it('returns config after loadConfig()', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ remoteUrl: 'http://10.0.0.1:3333' }),
      );
      await loadConfig();
      expect(getConfig().remoteUrl).toBe('http://10.0.0.1:3333');
    });

    it('throws if called before loadConfig()', async () => {
      // Reset module to get a fresh cachedConfig = null state
      vi.resetModules();
      vi.doMock('node:fs/promises', () => ({
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock('node:os', () => ({ homedir: () => '/home/testuser' }));
      const { getConfig: freshGetConfig } = await import('./config.js');
      expect(() => freshGetConfig()).toThrow('Config not loaded');
    });
  });

  describe('saveConfig()', () => {
    it('writes JSON to disk', async () => {
      const config = { remoteUrl: 'http://example.com', defaultModel: 'Test' };
      await saveConfig(config);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringMatching(/"remoteUrl"/),
        'utf-8',
      );
    });
  });

  describe('setConfigValue()', () => {
    it('updates a single key and saves', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ remoteUrl: 'http://old.com' }),
      );
      await setConfigValue('remoteUrl', 'http://new.com');
      const written = JSON.parse(mockWriteFile.mock.calls.at(-1)![1] as string);
      expect(written.remoteUrl).toBe('http://new.com');
    });
  });
});
