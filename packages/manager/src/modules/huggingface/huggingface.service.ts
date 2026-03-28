import { listModels, listFiles } from '@huggingface/hub';
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  SearchResult,
  GGUFFile,
  DownloadProgress,
} from './huggingface.types.js';
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
  async searchModels(
    query: string,
    limit: number = 20,
  ): Promise<SearchResult[]> {
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
      for await (const file of listFiles({
        repo: repoId,
        ...(token ? { accessToken: token } : {}),
      })) {
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
    const url = `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(filename)}`;
    const destPath = join(destDir, filename.split('/').pop()!);
    const token = configService.getHfToken();

    const args = [
      '-L', // follow redirects
      '-o',
      destPath,
      '--progress-bar', // show progress on stderr
      '-f', // fail on HTTP errors
      '-#', // progress meter
    ];
    if (token) {
      args.push('-H', `Authorization: Bearer ${token}`);
    }
    args.push(url);

    return new Promise<string>((resolve, reject) => {
      const proc = spawn('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });

      let stderrBuf = '';

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString();
        // curl progress bar outputs lines like "###                           10.5%"
        const percentMatch = stderrBuf.match(/([\d.]+)\s*%/);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1]);
          onProgress?.({
            filename,
            downloadedBytes: 0,
            totalBytes: 0,
            percent,
          });
          stderrBuf = '';
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to start curl: ${err.message}`));
      });

      proc.on('close', async (code) => {
        if (code === 22) {
          // curl -f returns 22 for HTTP errors (4xx/5xx)
          reject(
            new Error(
              'Hugging Face authentication failed.\n' +
                'A token is required to download this file.\n' +
                'Go to Settings (press 4) and set your Hugging Face token (hf_...).',
            ),
          );
          return;
        }
        if (code !== 0) {
          reject(
            new Error(`curl exited with code ${code}: ${stderrBuf.trim()}`),
          );
          return;
        }

        // Read final file size for the last progress report
        try {
          const fileStat = await stat(destPath);
          onProgress?.({
            filename,
            downloadedBytes: fileStat.size,
            totalBytes: fileStat.size,
            percent: 100,
          });
        } catch {
          // stat failed — still report completion
          onProgress?.({
            filename,
            downloadedBytes: 0,
            totalBytes: 0,
            percent: 100,
          });
        }

        resolve(destPath);
      });
    });
  }
}

export const huggingFaceService = new HuggingFaceService();
