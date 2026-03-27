import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelsService } from './models.service.js';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { readdir, stat, unlink } from 'node:fs/promises';

const mockReaddir = vi.mocked(readdir);
const mockStat = vi.mocked(stat);
const mockUnlink = vi.mocked(unlink);

function makeStat(size: number, mtime: Date) {
  return { size, mtime } as Awaited<ReturnType<typeof stat>>;
}

describe('ModelsService', () => {
  let svc: ModelsService;

  beforeEach(() => {
    svc = new ModelsService();
  });

  // ── listLocal() ────────────────────────────────────────────────────────────
  describe('listLocal()', () => {
    it('returns .gguf files sorted by mtime descending', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-06-01');
      mockReaddir.mockResolvedValueOnce([
        'old.gguf',
        'readme.txt',
        'new.gguf',
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockStat
        .mockResolvedValueOnce(makeStat(1000, older)) // old.gguf
        .mockResolvedValueOnce(makeStat(2000, newer)); // new.gguf

      const models = await svc.listLocal('/models');
      expect(models).toHaveLength(2);
      expect(models[0].filename).toBe('new.gguf');
      expect(models[1].filename).toBe('old.gguf');
    });

    it('filters out non-.gguf files', async () => {
      mockReaddir.mockResolvedValueOnce([
        'model.bin',
        'notes.txt',
        'model.gguf',
      ] as unknown as Awaited<ReturnType<typeof readdir>>);
      mockStat.mockResolvedValueOnce(makeStat(500, new Date()));

      const models = await svc.listLocal('/models');
      expect(models).toHaveLength(1);
      expect(models[0].filename).toBe('model.gguf');
    });

    it('returns [] when directory does not exist (readdir error)', async () => {
      mockReaddir.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      );
      const models = await svc.listLocal('/no/such/dir');
      expect(models).toEqual([]);
    });

    it('returns [] for empty directory', async () => {
      mockReaddir.mockResolvedValueOnce(
        [] as unknown as Awaited<ReturnType<typeof readdir>>,
      );
      const models = await svc.listLocal('/empty');
      expect(models).toEqual([]);
    });

    it('populates all LocalModel fields', async () => {
      const mtime = new Date('2025-01-15');
      mockReaddir.mockResolvedValueOnce(['m.gguf'] as unknown as Awaited<
        ReturnType<typeof readdir>
      >);
      mockStat.mockResolvedValueOnce(makeStat(1_500_000, mtime));

      const [m] = await svc.listLocal('/models');
      expect(m.filename).toBe('m.gguf');
      expect(m.path).toBe('/models/m.gguf');
      expect(m.sizeBytes).toBe(1_500_000);
      expect(m.lastModified).toEqual(mtime);
    });
  });

  // ── deleteModel() ──────────────────────────────────────────────────────────
  describe('deleteModel()', () => {
    it('calls unlink with the provided path', async () => {
      await svc.deleteModel('/models/m.gguf');
      expect(mockUnlink).toHaveBeenCalledWith('/models/m.gguf');
    });

    it('propagates errors from unlink', async () => {
      mockUnlink.mockRejectedValueOnce(new Error('Permission denied'));
      await expect(svc.deleteModel('/models/locked.gguf')).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  // ── getModelPath() ─────────────────────────────────────────────────────────
  describe('getModelPath()', () => {
    it('joins dir and filename', () => {
      expect(svc.getModelPath('/models', 'test.gguf')).toBe(
        '/models/test.gguf',
      );
    });
  });
});
