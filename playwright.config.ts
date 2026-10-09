import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  // Software-rendered CI browsers need longer for repeated day/night redraws.
  // Keep the same assertions and single worker; bound slower runners explicitly.
  timeout: process.env.CI ? 120000 : 45000,
  use: {
    baseURL: process.env.DEMO_URL ?? "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
