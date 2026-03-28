import type { CacheType, OnOffSetting } from '../config/config.types.js';
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
  cacheTypeK: CacheType;
  cacheTypeV: CacheType;
  flashAttn: OnOffSetting;
  fit: OnOffSetting;
  extraFlags: string;
}

export interface LaunchResult {
  process: ChildProcess;
  port: number;
}
