const { spawnSync } = require("node:child_process");
const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "0" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
