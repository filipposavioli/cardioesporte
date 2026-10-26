import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.artefatos",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    // "/" redireciona (307 → /entrar); /entrar responde 200 com ou sem sessão.
    url: "http://localhost:3000/entrar",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
