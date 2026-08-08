import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/google-chrome'
const e2eBaseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: e2eBaseUrl,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(existsSync(chromePath) ? { launchOptions: { executablePath: chromePath } } : {}),
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
