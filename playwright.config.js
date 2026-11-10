import { defineConfig } from '@playwright/test';
const mobile = (width, height) => ({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, channel: 'chrome' });
export default defineConfig({
  testDir: 'tests', timeout: 90000, workers: 1, reporter: 'list',
  use: { baseURL: 'http://localhost:4173/' },
  webServer: { command: 'node tests/server.mjs', url: 'http://localhost:4173/', reuseExistingServer: true },
  projects: [
    { name: 'iphone-portrait', use: mobile(390, 844) },
    { name: 'android-landscape', use: mobile(915, 412) },
    { name: 'ipad', use: mobile(820, 1180) },
  ],
});
