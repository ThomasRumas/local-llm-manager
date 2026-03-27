/// <reference types="vitest/globals" />
// Global test setup for packages/manager
// Silence console.error output during tests unless VERBOSE_TESTS=1
if (!process.env['VERBOSE_TESTS']) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}
