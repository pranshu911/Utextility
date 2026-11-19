const { defineConfig } = require("@playwright/test");
const port = Number(process.env.UTEXTILITY_TEST_PORT || 4391);
const url = "http://127.0.0.1:" + port;

module.exports = defineConfig({
  testDir: "./tests/browser",
  workers: 3,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: "list",
  globalSetup: require.resolve("./tests/start-server.cjs"),
  use: { baseURL: url, actionTimeout: 8_000, viewport: { width: 1280, height: 900 }, colorScheme: "light" },
  projects: ["chromium", "firefox", "webkit"].map(browserName => ({ name: browserName, use: { browserName } })),
});
