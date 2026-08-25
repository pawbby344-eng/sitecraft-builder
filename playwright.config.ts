import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    storageState: process.env.E2E_STORAGE_STATE,
    headless: true,
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH ?? "/usr/bin/chromium" },
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH ?? "/usr/bin/chromium" } } }],
});
