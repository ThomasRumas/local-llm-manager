import type { ChildProcess } from 'node:child_process';

export interface LlamaStatus {
  installed: boolean;
  path?: string;
  version?: string;
}

export interface LaunchOptions {
  modelPath: string;
  alias: string;
  temp: number;
  topP: number;
  topK: number;
  minP: number;
  port: number;
  ctxSize: number;
  kvUnified: boolean;
  cacheTypeK: string;
  cacheTypeV: string;
  flashAttn: string;
  fit: string;
  extraFlags: string;
}

export interface LaunchResult {
  process: ChildProcess;
  port: number;
}
