import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/google-chrome'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(existsSync(chromePath) ? { launchOptions: { executablePath: chromePath } } : {}),
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
