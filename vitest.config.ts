import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './src/__tests__/globalSetup.ts',
    setupFiles: ['./src/__tests__/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      JWT_SECRET: 'test-jwt-secret-for-vitest-only-do-not-use-in-prod',
      NODE_ENV: 'test',
      PORT: '0',
      CORS_ORIGIN: '*',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/placeholder',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/app.ts'],
    },
  },
});
