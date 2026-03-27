import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { ProgressBar } from '../components/progress-bar.js';
import { StatusBadge } from '../components/status-badge.js';
import { huggingFaceService } from '../modules/huggingface/huggingface.service.js';
import { configService } from '../modules/config/config.service.js';
import type { SearchResult, GGUFFile, DownloadProgress } from '../modules/huggingface/huggingface.types.js';

interface SearchModelsProps {
  onBack: () => void;
}

type SearchStep = 'input' | 'results' | 'files' | 'downloading' | 'done';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(1)} KB`;
}

const GGUF_TAG_KEYWORDS = ['gguf', 'text-generation', 'llm'];

function filterDisplayTags(tags: string[]): string[] {
  return tags
    .filter((t) => GGUF_TAG_KEYWORDS.some((k) => t.toLowerCase().includes(k)) || t.length < 20)
    .slice(0, 4);
}

/**
 * Extracts the quantization level from a GGUF filename.
 * e.g. "Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf" → "Q4_K_XL"
 *      "model-IQ3_XXS.gguf" → "IQ3_XXS"
 *      "model-BF16.gguf"    → "BF16"
 */
function extractQuant(filename: string): string {
  const basename = filename.split('/').pop() ?? filename;
  const match = basename.match(/[-.]((IQ|BF?|Q)\d[A-Z0-9_]*)(?:\.gguf)?$/i);
  return match ? match[1].toUpperCase() : 'GGUF';
}

export function SearchModels({ onBack }: SearchModelsProps) {
  const [step, setStep] = useState<SearchStep>('input');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [ggufFiles, setGgufFiles] = useState<GGUFFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setSelectedResultIdx(0);
    try {
      const models = await huggingFaceService.searchModels(query);
      setResults(models);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleSelectModel = useCallback(async (idx: number) => {
    const model = results[idx];
    if (!model) return;
    setLoadingFiles(true);
    setError(null);
    setSelectedFileIdx(0);
    try {
      const files = await huggingFaceService.listGGUFFiles(model.repoId);
      setGgufFiles(files);
      setStep('files');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFiles(false);
    }
  }, [results]);

  const handleSelectFile = useCallback(async (idx: number) => {
    const file = ggufFiles[idx];
    const model = results[selectedResultIdx];
    if (!file || !model) return;
    setStep('downloading');
    setError(null);
    try {
      const modelsDir = configService.getModelsDirectory();
      const destPath = await huggingFaceService.downloadModel(
        model.repoId,
        file.filename,
        modelsDir,
        (p) => setProgress(p),
      );
      setDownloadedPath(destPath);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('files');
    }
  }, [ggufFiles, results, selectedResultIdx]);

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'input' || step === 'done') { onBack(); return; }
      if (step === 'results') { setStep('input'); return; }
      if (step === 'files') { setStep('results'); return; }
    }

    if (step === 'input' && !searching) {
      if (key.return) { handleSearch(); return; }
      if (key.backspace || key.delete) { setQuery((p) => p.slice(0, -1)); return; }
      if (!key.ctrl && !key.meta && !key.upArrow && !key.downArrow && !key.tab) {
        setQuery((p) => p + input);
      }
    }

    if (step === 'results' && !loadingFiles) {
      if (key.upArrow) setSelectedResultIdx((p) => Math.max(0, p - 1));
      if (key.downArrow) setSelectedResultIdx((p) => Math.min(results.length - 1, p + 1));
      if (key.return) handleSelectModel(selectedResultIdx);
    }

    if (step === 'files') {
      if (key.upArrow) setSelectedFileIdx((p) => Math.max(0, p - 1));
      if (key.downArrow) setSelectedFileIdx((p) => Math.min(ggufFiles.length - 1, p + 1));
      if (key.return) handleSelectFile(selectedFileIdx);
    }
  });

  return (
    <Box flexDirection="column" gap={1} height="100%">
      {error && <StatusBadge status="error" label={error} />}

      {/* ── Input ─────────────────────────────────────── */}
      <Box borderStyle="round" borderColor={step === 'input' ? 'cyan' : 'gray'} paddingX={1}>
        <Text dimColor>Search: </Text>
        <Text color="cyan">{query}</Text>
        {step === 'input' && <Text color="cyan">▎</Text>}
        {searching && <Text color="gray"> Searching…</Text>}
      </Box>

      {/* ── Results list ──────────────────────────────── */}
      {step === 'results' && (
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          <Text dimColor>{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</Text>
          {results.length === 0 && <Text color="yellow">No models found.</Text>}
          {loadingFiles && <StatusBadge status="loading" label="Loading GGUF files…" />}
          <Box flexDirection="column" overflow="hidden">
            {results.map((r, i) => {
              const isSelected = i === selectedResultIdx;
              const displayTags = filterDisplayTags(r.tags);
              return (
                <Box key={r.repoId} flexDirection="column" marginBottom={0}>
                  {/* Row 1: selector + author/name (no gap) + downloads + likes */}
                  <Box gap={1}>
                    <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '❯' : ' '}</Text>
                    <Text bold>
                      <Text color={isSelected ? 'cyan' : 'gray'}>{r.author}/</Text><Text color={isSelected ? 'white' : 'white'}>{r.name}</Text>
                    </Text>
                    <Text color="gray">↓{formatCount(r.downloads)}</Text>
                    <Text color="gray">♥{formatCount(r.likes)}</Text>
                  </Box>
                  {/* Row 2: tags (only for selected) */}
                  {isSelected && displayTags.length > 0 && (
                    <Box paddingLeft={3} gap={1}>
                      {displayTags.map((t) => (
                        <Text key={t} color="gray" dimColor>[{t}]</Text>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── GGUF file picker ──────────────────────────── */}
      {step === 'files' && (
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          <Text dimColor>
            Files in <Text color="cyan">{results[selectedResultIdx]?.repoId}</Text>
            <Text color="gray">  ({ggufFiles.length} quantization{ggufFiles.length !== 1 ? 's' : ''})</Text>
          </Text>
          {ggufFiles.length === 0 && <Text color="yellow">No GGUF files found.</Text>}
          {/* Column headers */}
          {ggufFiles.length > 0 && (
            <Box gap={0} paddingLeft={2}>
              <Box width={14}><Text dimColor bold>Quantization</Text></Box>
              <Box width={10}><Text dimColor bold>Size</Text></Box>
              <Text dimColor bold>Filename</Text>
            </Box>
          )}
          <Box flexDirection="column" overflow="hidden">
            {ggufFiles.map((f, i) => {
              const isSelected = i === selectedFileIdx;
              const quant = extractQuant(f.filename);
              const basename = f.filename.split('/').pop()!;
              return (
                <Box key={f.filename} gap={0}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '❯ ' : '  '}</Text>
                  <Box width={12}>
                    <Text bold color={isSelected ? 'cyan' : 'white'} wrap="truncate">{quant}</Text>
                  </Box>
                  <Box width={10}>
                    <Text color={isSelected ? 'white' : 'gray'}>{formatSize(f.sizeBytes)}</Text>
                  </Box>
                  <Text color="gray" dimColor wrap="truncate">{basename}</Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── Downloading ───────────────────────────────── */}
      {step === 'downloading' && progress && (
        <Box flexDirection="column" gap={1} flexGrow={1}>
          <Text>Downloading {progress.filename.split('/').pop()}…</Text>
          <ProgressBar
            percent={progress.percent}
            label={`${formatSize(progress.downloadedBytes)} / ${formatSize(progress.totalBytes)}`}
          />
        </Box>
      )}

      {/* ── Done ─────────────────────────────────────── */}
      {step === 'done' && downloadedPath && (
        <Box flexDirection="column" gap={1}>
          <StatusBadge status="success" label="Download complete!" />
          <Text dimColor>Saved to: {downloadedPath}</Text>
          <Text dimColor>Press Esc to go back</Text>
        </Box>
      )}
    </Box>
  );
}
