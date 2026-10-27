import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:8765";
const useLocalServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    },
  ],
  ...(useLocalServer
    ? {
        webServer: {
          command:
            "VITE_API_BASE=${VITE_API_BASE:-https://api.dev.verifiednepal.com} VITE_NEWS_API_BASE=${VITE_NEWS_API_BASE:-https://api.news-dev.verifiednepal.com} VITE_NEWS_SITE_BASE=${VITE_NEWS_SITE_BASE:-https://news-dev.verifiednepal.com} pnpm dev -- --host 0.0.0.0 --port 8765",
          url: "http://localhost:8765",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
