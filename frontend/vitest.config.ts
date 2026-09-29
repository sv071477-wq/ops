import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '*.{test,spec}.{ts,tsx}',
      'app/**/*.{test,spec}.{ts,tsx}',
      'components/**/*.{test,spec}.{ts,tsx}',
      'context/**/*.{test,spec}.{ts,tsx}',
      'lib/**/*.{test,spec}.{ts,tsx}',
      'hooks/**/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 30,
          functions: 30,
          lines: 30,
          statements: 30,
        },
        'lib/dateUtils.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'components/ui/**': {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.d.ts',
        '**/*.stories.tsx',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'vitest.setup.ts',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    // Mirrors tsconfig.json's `@/*` -> `./*` mapping. Listed most specific
    // first because Vite aliases match by prefix.
    alias: {
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/context': path.resolve(__dirname, './context'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
