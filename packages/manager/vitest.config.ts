import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    mockReset: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/index.tsx', // Ink render entry point – not unit-testable
        'src/app.tsx', // Top-level composition component
        'src/components/full-screen.tsx', // Layout shell – requires full Ink context
        'src/components/select-field.tsx', // useFocus-gated; interactive paths need FocusManager
        'src/components/text-input-field.tsx', // useFocus-gated; interactive paths need FocusManager
        'src/components/number-input-field.tsx', // useFocus-gated; interactive paths need FocusManager
        'src/contexts/server-context.tsx', // React context provider
        'src/hooks/use-window-size.ts', // Thin wrapper over Ink's useStdout
        'src/hooks/use-system-stats.ts', // Polling hook; depends on systemStatsService
        'src/modules/huggingface/huggingface.service.ts', // External HF API; tested via integration
        'src/modules/system/system-stats.service.ts', // Platform-specific shell commands
        'src/daemon.ts', // Headless entry point — top-level await, not unit-testable
        'src/**/*.test.*',
        'src/test-setup.ts',
        'src/**/*.types.ts', // Pure type files, no runtime logic
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
