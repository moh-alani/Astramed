import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: process.env.ASTRAMED_TEST_URL || "http://127.0.0.1:4173/",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.ASTRAMED_TEST_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
      },
});
