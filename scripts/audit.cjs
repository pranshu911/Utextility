const fs = require("node:fs/promises");
const path = require("node:path");
const { listen } = require("./serve.cjs");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= "0";
const { chromium } = require("playwright");

const sampleCount = 20;
const samples = "The release  notes are ready. Review the changes\nbefore sharing them.\n\n";
const button = (page, name) => page.getByRole("button", { name, exact: true });

async function capture(browser, url) {
  const target = path.resolve(__dirname, "../docs/audit");
  await fs.mkdir(target, { recursive: true });
  for (const [name, width, height] of [["desktop", 1440, 960], ["phone", 390, 844], ["dark-changes", 1280, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: "light", reducedMotion: "reduce" });
    try {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      if (name === "phone") {
        await button(page, "Tidy a list").click();
        await page.locator("#source").fill("Blue ink\nCotton paper\nblue ink\n\nCopper plate\nCotton paper");
        await page.getByRole("checkbox").check();
      } else {
        await page.locator("#source").fill("  Release   notes are ready\nfor Friday.\n\nPlease review the   changes\nbefore the team meeting.");
      }
      if (name === "dark-changes") {
        await button(page, "Changes").click();
        await button(page, "Use dark mode").click();
      }
      await page.waitForFunction(() => !document.querySelector("#copy").disabled);
      await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: path.join(target, name + ".png"), fullPage: true, animations: "disabled" });
    } finally {
      await page.close();
    }
  }
}

async function measure(page, size, count) {
  return page.evaluate(async ({ size, count, samples }) => {
    const source = document.querySelector("#source"), copy = document.querySelector("#copy");
    const input = samples.repeat(Math.ceil(size / samples.length)).slice(0, size - 1);
    const times = [];
    for (let i = 0; i <= count; i++) {
      source.value = input + String(i % 10);
      const ready = new Promise(resolve => {
        const observer = new MutationObserver(() => {
          if (!copy.disabled) { observer.disconnect(); resolve(performance.now()); }
        });
        observer.observe(copy, { attributes: true, attributeFilter: ["disabled"] });
      });
      const start = performance.now();
      source.dispatchEvent(new Event("input", { bubbles: true }));
      const elapsed = (await ready) - start;
      if (i > 0) times.push(elapsed);
    }
    times.sort((a, b) => a - b);
    return { medianMs: Math.round((times[count / 2 - 1] + times[count / 2]) / 2),
      p95Ms: Math.round(times[Math.ceil(.95 * count) - 1]) };
  }, { size, count, samples });
}

async function run() {
  const server = await listen(0);
  let browser;
  try {
    const url = "http://127.0.0.1:" + server.address().port + "/";
    browser = await chromium.launch();
    if (process.argv.includes("--screenshots")) await capture(browser, url);
    const page = await browser.newPage();
    const externalRequests = new Set();
    page.context().on("request", request => {
      if (new URL(request.url()).origin !== new URL(url).origin) externalRequests.add(request.url());
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const resources = await page.evaluate(() => [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")]
      .map(entry => ({ file: new URL(entry.name).pathname, decodedBytes: entry.decodedBodySize })));
    const times = {};
    const cdp = await page.context().newCDPSession(page);
    for (const rate of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      for (const size of [1_000, 100_000]) times[rate + "x/" + size] = await measure(page, size, sampleCount);
    }
    console.log(JSON.stringify({ chromium: browser.version(), node: process.version, samples: sampleCount, resources,
      decodedBytes: resources.reduce((sum, file) => sum + file.decodedBytes, 0), externalRequestCount: externalRequests.size, times }, null, 2));
  } finally {
    try { if (browser) await browser.close(); }
    finally { server.closeAllConnections(); server.close(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
