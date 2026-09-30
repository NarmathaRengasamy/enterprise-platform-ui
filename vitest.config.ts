import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/* Kept separate from vite.config.ts so the app build is untouched. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_API_URL: 'http://api.test/api/v1' },
  },
});
