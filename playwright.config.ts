import { defineConfig, devices } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT || 5098);
const UI_PORT = Number(process.env.E2E_UI_PORT || 5199);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${UI_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${UI_PORT} --strictPort`,
    url: `http://localhost:${UI_PORT}/e2e-harness/media.html`,
    reuseExistingServer: false,
    env: { VITE_API_URL: `http://localhost:${API_PORT}/api/v1` },
  },
});
