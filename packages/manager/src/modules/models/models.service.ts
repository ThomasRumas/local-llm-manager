import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { LocalModel } from './models.types.js';

export class ModelsService {
  async listLocal(modelsDir: string): Promise<LocalModel[]> {
    try {
      const entries = await readdir(modelsDir);
      const ggufFiles = entries.filter((f) => f.endsWith('.gguf'));

      const models: LocalModel[] = await Promise.all(
        ggufFiles.map(async (filename) => {
          const filePath = join(modelsDir, filename);
          const fileStat = await stat(filePath);
          return {
            filename,
            path: filePath,
            sizeBytes: fileStat.size,
            lastModified: fileStat.mtime,
            hasConfig: false,
          };
        }),
      );

      return models.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );
    } catch {
      return [];
    }
  }

  async deleteModel(modelPath: string): Promise<void> {
    await unlink(modelPath);
  }

  getModelPath(modelsDir: string, filename: string): string {
    return join(modelsDir, filename);
  }
}

export const modelsService = new ModelsService();
