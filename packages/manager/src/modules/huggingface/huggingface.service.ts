import { listModels, listFiles } from '@huggingface/hub';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import type { SearchResult, GGUFFile, DownloadProgress } from './huggingface.types.js';
import { configService } from '../config/config.service.js';

/** Converts raw HF 401 / "Invalid username or password" errors into a readable message. */
function rewriteHfAuthError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.toLowerCase().includes('invalid username or password') ||
    msg.toLowerCase().includes('401') ||
    msg.toLowerCase().includes('unauthorized')
  ) {
    throw new Error(
      'Hugging Face authentication failed.\n' +
      'A token is required to access this repository.\n' +
      'Go to Settings (press 4) and set your Hugging Face token (hf_...).',
    );
  }
  throw err;
}

export class HuggingFaceService {
  async searchModels(query: string, limit: number = 20): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    const token = configService.getHfToken();
    try {
      for await (const model of listModels({
        search: { query },
        additionalFields: ['author', 'tags'] as const,
        limit,
        ...(token ? { accessToken: token } : {}),
      })) {
        // model.name is the human-readable repo name (e.g. "Jackrong/Qwen3.5-8B")
        // model.id  is the internal hex ID — do NOT use it for display or API calls
        const author = model.author ?? model.name.split('/')[0] ?? '';
        const modelName = model.name.includes('/')
          ? model.name.split('/').slice(1).join('/')
          : model.name;

        results.push({
          repoId: model.name,
          name: modelName,
          author,
          downloads: model.downloads,
          likes: model.likes,
          lastModified: model.updatedAt.toISOString(),
          tags: model.tags ?? [],
        });
      }
    } catch (err) {
      rewriteHfAuthError(err);
    }

    return results;
  }

  async listGGUFFiles(repoId: string): Promise<GGUFFile[]> {
    const files: GGUFFile[] = [];
    const token = configService.getHfToken();

    try {
      for await (const file of listFiles({ repo: repoId, ...(token ? { accessToken: token } : {}) })) {
        if (file.path.endsWith('.gguf')) {
          files.push({
            filename: file.path,
            sizeBytes: file.size ?? 0,
            repoId,
          });
        }
      }
    } catch (err) {
      rewriteHfAuthError(err);
    }

    return files.sort((a, b) => a.sizeBytes - b.sizeBytes);
  }

  async downloadModel(
    repoId: string,
    filename: string,
    destDir: string,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<string> {
    const url = `https://huggingface.co/${repoId}/resolve/main/${filename}`;
    const token = configService.getHfToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Hugging Face authentication failed.\n' +
          'A token is required to download this file.\n' +
          'Go to Settings (press 4) and set your Hugging Face token (hf_...).',
        );
      }
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const totalBytes = Number(response.headers.get('content-length') ?? 0);
    const destPath = join(destDir, filename.split('/').pop()!);

    let downloadedBytes = 0;
    const body = response.body;

    if (!body) {
      throw new Error('Response body is null');
    }

    const reader = body.getReader();
    const nodeStream = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        downloadedBytes += value.byteLength;
        onProgress?.({
          filename,
          downloadedBytes,
          totalBytes,
          percent: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0,
        });
        this.push(Buffer.from(value));
      },
    });

    const writeStream = createWriteStream(destPath);
    await pipeline(nodeStream, writeStream);

    return destPath;
  }
}

export const huggingFaceService = new HuggingFaceService();
