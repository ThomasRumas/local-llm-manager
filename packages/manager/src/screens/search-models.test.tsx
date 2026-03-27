import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../modules/huggingface/huggingface.service.js', () => ({
  huggingFaceService: {
    searchModels: vi.fn(),
    listGGUFFiles: vi.fn(),
    downloadModel: vi.fn(),
  },
}));

vi.mock('../modules/config/config.service.js', () => ({
  configService: {
    getModelsDirectory: vi.fn().mockReturnValue('/models'),
  },
}));

import { huggingFaceService } from '../modules/huggingface/huggingface.service.js';
import { configService } from '../modules/config/config.service.js';
import { SearchModels } from './search-models.js';

const SAMPLE_RESULTS = [
  {
    repoId: 'unsloth/Qwen3-8B-GGUF',
    name: 'Qwen3-8B-GGUF',
    author: 'unsloth',
    tags: ['gguf', 'text-generation'],
    downloads: 5000,
    likes: 100,
    lastModified: '2025-01-01',
  },
];

const SAMPLE_FILES = [
  {
    filename: 'Qwen3-8B-Q4_K_M.gguf',
    sizeBytes: 5_000_000_000,
    repoId: 'unsloth/Qwen3-8B-GGUF',
  },
  {
    filename: 'Qwen3-8B-Q8_0.gguf',
    sizeBytes: 9_000_000_000,
    repoId: 'unsloth/Qwen3-8B-GGUF',
  },
];

describe('SearchModels', () => {
  beforeEach(() => {
    vi.mocked(configService.getModelsDirectory).mockReturnValue('/models');
    vi.mocked(huggingFaceService.searchModels).mockResolvedValue([]);
    vi.mocked(huggingFaceService.listGGUFFiles).mockResolvedValue([]);
    vi.mocked(huggingFaceService.downloadModel).mockResolvedValue(
      '/models/file.gguf',
    );
  });

  it('renders search input prompt', () => {
    const { lastFrame } = render(<SearchModels onBack={vi.fn()} />);
    expect(lastFrame()).toContain('Search');
  });

  it('calls onBack when Escape is pressed on input screen', async () => {
    const onBack = vi.fn();
    const instance = render(<SearchModels onBack={onBack} />);
    instance.stdin.write('\x1B'); // ESC
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('shows searching state after Enter', async () => {
    // Never resolves during test
    vi.mocked(huggingFaceService.searchModels).mockReturnValue(
      new Promise(() => {}),
    );
    const instance = render(<SearchModels onBack={vi.fn()} />);
    // Type 'q', wait for render, then press Enter (avoids stale closure on handleSearch)
    instance.stdin.write('q');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search: q'));
    instance.stdin.write('\r');
    await vi.waitFor(() => {
      expect(
        instance.lastFrame()!.includes('Searching') ||
          instance.lastFrame()!.includes('result'),
      ).toBe(true);
    });
  });

  it('shows results after successful search', async () => {
    vi.mocked(huggingFaceService.searchModels).mockResolvedValue(
      SAMPLE_RESULTS,
    );
    const instance = render(<SearchModels onBack={vi.fn()} />);
    instance.stdin.write('q');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search: q'));
    instance.stdin.write('\r'); // Search
    await vi.waitFor(
      () => {
        expect(instance.lastFrame()).toContain('Qwen3-8B-GGUF');
      },
      { timeout: 3000 },
    );
  });

  it('shows GGUF files after selecting a model', async () => {
    vi.mocked(huggingFaceService.searchModels).mockResolvedValue(
      SAMPLE_RESULTS,
    );
    vi.mocked(huggingFaceService.listGGUFFiles).mockResolvedValue(SAMPLE_FILES);
    const instance = render(<SearchModels onBack={vi.fn()} />);
    instance.stdin.write('q');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search: q'));
    instance.stdin.write('\r');
    await vi.waitFor(
      () => expect(instance.lastFrame()).toContain('Qwen3-8B-GGUF'),
      { timeout: 3000 },
    );
    instance.stdin.write('\r'); // Select first result
    await vi.waitFor(
      () => {
        expect(instance.lastFrame()).toContain('Q4_K_M');
      },
      { timeout: 3000 },
    );
  });

  it('shows download progress when downloading', async () => {
    vi.mocked(huggingFaceService.searchModels).mockResolvedValue(
      SAMPLE_RESULTS,
    );
    vi.mocked(huggingFaceService.listGGUFFiles).mockResolvedValue(SAMPLE_FILES);
    vi.mocked(huggingFaceService.downloadModel).mockImplementation(
      async (_repo, _file, _dir, onProgress) => {
        onProgress?.({
          filename: 'file.gguf',
          percent: 50,
          downloadedBytes: 500,
          totalBytes: 1000,
        });
        return '/models/file.gguf';
      },
    );
    const instance = render(<SearchModels onBack={vi.fn()} />);
    instance.stdin.write('q');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search: q'));
    instance.stdin.write('\r');
    await vi.waitFor(
      () => expect(instance.lastFrame()).toContain('Qwen3-8B-GGUF'),
      { timeout: 3000 },
    );
    instance.stdin.write('\r'); // Select model
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Q4_K_M'), {
      timeout: 3000,
    });
    instance.stdin.write('\r'); // Select file
    await vi.waitFor(
      () => {
        const frame = instance.lastFrame();
        expect(
          frame!.includes('ownload') ||
            frame!.includes('Done') ||
            frame!.includes('complete'),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it('navigates results list with arrow keys', async () => {
    const moreResults = [
      ...SAMPLE_RESULTS,
      {
        ...SAMPLE_RESULTS[0],
        repoId: 'other/Model2',
        name: 'Model2',
        downloads: 100,
      },
    ];
    vi.mocked(huggingFaceService.searchModels).mockResolvedValue(moreResults);
    const instance = render(<SearchModels onBack={vi.fn()} />);
    instance.stdin.write('q');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search: q'));
    instance.stdin.write('\r');
    await vi.waitFor(
      () => expect(instance.lastFrame()).toContain('Qwen3-8B-GGUF'),
      { timeout: 3000 },
    );
    // Navigate down to select second result
    instance.stdin.write('\x1B[B'); // Down
    await new Promise((r) => setTimeout(r, 50));
    instance.stdin.write('\x1B[A'); // Up
    await new Promise((r) => setTimeout(r, 50));
    // ESC back to input
    instance.stdin.write('\x1B');
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Search');
    });
  });

  it('navigates files list with arrow keys', async () => {
    vi.mocked(huggingFaceService.searchModels).mockResolvedValue(
      SAMPLE_RESULTS,
    );
    vi.mocked(huggingFaceService.listGGUFFiles).mockResolvedValue(SAMPLE_FILES);
    const instance = render(<SearchModels onBack={vi.fn()} />);
    instance.stdin.write('q');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Search: q'));
    instance.stdin.write('\r');
    await vi.waitFor(
      () => expect(instance.lastFrame()).toContain('Qwen3-8B-GGUF'),
      { timeout: 3000 },
    );
    instance.stdin.write('\r'); // Select model → files view
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Q4_K_M'), {
      timeout: 3000,
    });
    instance.stdin.write('\x1B[B'); // Down in files
    await new Promise((r) => setTimeout(r, 50));
    instance.stdin.write('\x1B[A'); // Up in files
    await new Promise((r) => setTimeout(r, 50));
    instance.stdin.write('\x1B'); // ESC back to results
    await vi.waitFor(
      () => {
        expect(instance.lastFrame()).toContain('Qwen3-8B-GGUF');
      },
      { timeout: 3000 },
    );
  });
});
