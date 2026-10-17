import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', channel: process.env.CI ? undefined : 'chrome', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', screenshot: 'only-on-failure' },
  webServer: { command: process.env.CI ? 'npm run preview' : 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
