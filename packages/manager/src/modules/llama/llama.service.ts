import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import type { LlamaStatus, LaunchOptions, LaunchResult } from './llama.types.js';

const execFileAsync = promisify(execFile);

export class LlamaService {
  async detect(): Promise<LlamaStatus> {
    try {
      const { stdout } = await execFileAsync('which', ['llama-server']);
      const path = stdout.trim();
      if (!path) {
        return { installed: false };
      }
      const version = await this.getVersion(path);
      return { installed: true, path, version };
    } catch {
      return { installed: false };
    }
  }

  private async getVersion(binaryPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(binaryPath, ['--version']);
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  install(onData: (data: string) => void): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn('brew', ['install', 'llama.cpp'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (chunk: Buffer) => onData(chunk.toString()));
      proc.stderr?.on('data', (chunk: Buffer) => onData(chunk.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `brew exited with code ${code}` });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  launch(options: LaunchOptions): LaunchResult {
    const args = this.buildArgs(options);
    const proc = spawn('llama-server', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return { process: proc, port: options.port };
  }

  private buildArgs(options: LaunchOptions): string[] {
    const args: string[] = [
      '--model', options.modelPath,
      '--alias', options.alias || options.modelPath,
      '--temp', String(options.temp),
      '--top-p', String(options.topP),
      '--top-k', String(options.topK),
      '--min-p', String(options.minP),
      '--port', String(options.port),
      '--ctx-size', String(options.ctxSize),
      '--cache-type-k', options.cacheTypeK,
      '--cache-type-v', options.cacheTypeV,
    ];

    if (options.kvUnified) {
      args.push('--kv-unified');
    }

    if (options.flashAttn && options.flashAttn !== 'off') {
      args.push('--flash-attn', options.flashAttn); // e.g. 'on' or 'auto'
    }

    if (options.fit && options.fit !== 'off') {
      args.push('--fit', options.fit); // e.g. 'on'
    }

    if (options.extraFlags) {
      const extra = options.extraFlags.trim().split(/\s+/);
      args.push(...extra);
    }

    return args;
  }
}

export const llamaService = new LlamaService();
