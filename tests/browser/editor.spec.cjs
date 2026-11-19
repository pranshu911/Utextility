const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const button = (page, name) => page.getByRole("button", { name, exact: true });
const input = page => page.getByRole("textbox", { name: "Your text", exact: true });
const result = page => page.getByRole("region", { name: "Edited text", exact: true });
const dialog = page => page.getByRole("dialog");

test.beforeEach(async ({ page }) => { await page.goto("/"); });
test.afterEach(async ({ page }) => {
  const errors = await page.pageErrors();
  expect(errors.map(error => error.message)).toEqual([]);
});

test("typing starts on a blank sheet and switching tools preserves the original", async ({ page }) => {
  await expect(input(page)).toHaveValue("");
  await expect(button(page, "Copy result")).toBeDisabled();
  await input(page).pressSequentially("My words");
  await expect(result(page)).toHaveText("My words");
  const text = "  Print  room\nopens today.\n\n- Paper\n- Ink";
  await input(page).fill(text);
  await expect(result(page)).toHaveText("Print room opens today.\n\n- Paper\n- Ink", { useInnerText: true });
  await button(page, "Make link names").click();
  await expect(input(page)).toHaveValue(text);
  await expect(result(page)).toContainText("print-room\nopens-today");
  await button(page, "Try an example").click();
  await expect(input(page)).toHaveValue(/हिन्दी/);
  await button(page, "Undo").click();
  await expect(input(page)).toHaveValue(text);
  await button(page, "Clear").click();
  await expect(input(page)).toHaveValue("");
  await button(page, "Undo").click();
  await expect(input(page)).toHaveValue(text);
});

test("list cleanup keeps first spelling and warns on repeated link names", async ({ page }) => {
  await button(page, "Tidy a list").click();
  await input(page).fill("  Ink\n\nink\nPaper\nInk\nPAPER");
  await expect(result(page)).toHaveText("Ink\nink\nPaper\nPAPER");
  const option = page.getByRole("checkbox", { name: /same item/ });
  await option.check(); await expect(result(page)).toHaveText("Ink\nPaper");
  await option.uncheck(); await expect(result(page)).toHaveText("Ink\nink\nPaper\nPAPER");
  await button(page, "Make link names").click();
  await input(page).fill("Ink Press\n\nInk-Press\nहिन्दी पाठ");
  await expect(page.locator("#link-note")).toContainText("lines 1 and 2");
  await expect(result(page)).toHaveText("ink-press\nink-press\nहिन्दी-पाठ");
  await input(page).fill("Ink Press\nPaper");
  await expect(page.locator("#link-note")).toBeHidden();
});

test("find and replace is literal, counts matches, supports removal and leaves source intact", async ({ page }) => {
  await button(page, "Find and replace").click();
  const text = "one.two...ONE";
  await input(page).fill(text);
  await page.getByLabel("Find", { exact: true }).fill(".");
  await page.getByLabel("Replace with", { exact: true }).fill("$&");
  await expect(result(page)).toHaveText("one$&two$&$&$&ONE");
  await expect(page.getByText("4 matches", { exact: true })).toBeVisible();
  await page.getByLabel("Replace with", { exact: true }).fill("");
  await expect(result(page)).toHaveText("onetwoONE");
  await page.getByLabel("Find", { exact: true }).fill("One");
  await expect(page.getByText("No matches", { exact: true })).toBeVisible();
  await expect(input(page)).toHaveValue(text);
  await button(page, "Try an example").click(); await button(page, "Undo").click();
  await expect(input(page)).toHaveValue(text);
});

test("changes are marked visibly and limits follow the edited text", async ({ page }) => {
  await input(page).fill("  One   two  ");
  await button(page, "Changes").click();
  await expect(page.locator("#changes del").first()).toBeVisible();
  await expect(page.locator("#changes ins").first()).toBeVisible();
  await expect(page.locator("#changes")).toContainText("Removed");
  await button(page, "Set a limit").click();
  await page.getByLabel("Maximum").fill("1"); await button(page, "Apply").click();
  await expect(page.locator("#limit-status")).toHaveText("1 word over the limit.");
  await button(page, "Edit limit").click(); await page.getByLabel("Count", { exact: true }).selectOption("characters");
  await page.getByLabel("Maximum").fill("7"); await button(page, "Apply").click();
  await expect(page.locator("#limit-status")).toContainText("Exactly");
  await input(page).fill("👩🏽‍💻"); await expect(page.locator('[data-stat="characters"]')).toHaveText("1");
  await expect(page.locator("#limit-status")).toHaveText("6 characters remaining.");
  await button(page, "Edit limit").click(); await button(page, "Remove").click();
  await expect(page.locator("#limit-status")).toBeEmpty();
});

test("search and categories offer one-click tools, with editing behind a disclosure", async ({ page }) => {
  await input(page).fill("20");
  await button(page, "More tools").click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await expect(dialog(page).getByRole("button", { name: /^Use / })).toHaveCount(4);
  await expect(page.locator("#step-editor")).toBeHidden();
  await dialog(page).getByText("Other tools", { exact: true }).click();
  await button(page, "Use Number to words").click(); await expect(result(page)).toHaveText("Twenty");
  await input(page).fill("invalid"); await expect(result(page)).toContainText("Step 1");
  await expect(button(page, "Download")).toBeDisabled();
  await button(page, "Edit steps").click(); await expect(page.locator("#step-editor")).toBeVisible();
  await page.getByRole("searchbox").fill("uppercase"); await button(page, "Add Make uppercase").click();
  await button(page, "Move Make uppercase up").click();
  await expect(page.locator("#step-editor li").first()).toContainText("Make uppercase");
  await button(page, "Move Make uppercase down").click();
  await page.keyboard.press("Escape");
  await input(page).fill("21"); await expect(result(page)).toHaveText("TWENTY ONE");
  await button(page, "Edit steps").click(); await button(page, "Remove Number to words").click();
  await page.keyboard.press("Escape"); await expect(result(page)).toHaveText("21");
  await button(page, "More tools").click(); await page.getByRole("searchbox").fill("no such tool");
  await expect(dialog(page)).toContainText("No matching tools");
});

async function nameSteps(page, name) {
  await button(page, "Saved steps").click(); await button(page, "Save current steps").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
}

test("saved steps survive reload including replacement settings, with explicit deletion and undo", async ({ page }) => {
  await button(page, "Find and replace").click();
  await input(page).fill("Private draft from Monday");
  await page.getByLabel("Find", { exact: true }).fill("draft");
  await page.getByLabel("Replace with", { exact: true }).fill("report");
  await nameSteps(page, "Publish");
  await expect(page.locator("#save-fields-note")).toBeVisible();
  await button(page, "Save steps").click(); await expect(button(page, "Use Publish")).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("Private"); expect(stored).toContain("report");
  await page.reload(); await expect(input(page)).toHaveValue("");
  await button(page, "Saved steps").click(); await button(page, "Use Publish").click();
  await input(page).fill("a draft"); await expect(result(page)).toHaveText("a report");
  await button(page, "Saved steps").click(); await button(page, "Delete Publish").click();
  await expect(button(page, "Use Publish")).toHaveCount(0);
  await button(page, "Undo deletion").click(); await expect(button(page, "Use Publish")).toBeVisible();
});

test("two tabs can save different tools and keep earlier v2 steps", async ({ context, page }) => {
  await page.evaluate(() => localStorage.setItem("utextility.v2.recipes", JSON.stringify([{ id:"user-legacy", name:"Earlier steps", steps:["lower"] }])));
  await page.reload();
  const other = await context.newPage(); await other.goto("/");
  await Promise.all([nameSteps(page, "Morning"), nameSteps(other, "Evening")]);
  await Promise.all([button(page, "Save steps").click(), button(other, "Save steps").click()]);
  for (const tab of [page, other]) {
    for (const name of ["Earlier steps","Morning","Evening"]) await expect(button(tab, "Use " + name)).toBeVisible();
  }
  await button(page, "Use Earlier steps").click(); await input(page).fill("WORDS"); await expect(result(page)).toHaveText("words");
  expect(await page.evaluate(() => localStorage.getItem("utextility.v2.recipes"))).toBeNull();
  await other.close();
});

test("blocked storage produces a useful message and keeps work available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Unavailable","SecurityError"); } });
  });
  await page.reload(); await input(page).fill("still   here"); await expect(result(page)).toHaveText("still here");
  await nameSteps(page, "My steps"); await button(page, "Save steps").click();
  await expect(page.locator("#dialog-notice")).toContainText("couldn’t save");
  await page.keyboard.press("Escape"); await expect(result(page)).toHaveText("still here");
  await button(page, "Use dark mode").click(); await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
});

test("UTF-8 files round-trip, invalid files preserve the editor, and download bytes match", async ({ page }) => {
  await button(page, "Tidy a list").click();
  await page.locator("#file").setInputFiles({ name:"notes.txt", mimeType:"text/plain", buffer:Buffer.from("\uFEFFCafé\r\n\r\nCafé\r\nहिन्दी") });
  await expect(result(page)).toHaveText("Café\nहिन्दी");
  const download = page.waitForEvent("download"); await button(page, "Download").click();
  const file = await download; expect(file.suggestedFilename()).toBe("utextility-result.txt");
  expect(await fs.readFile(await file.path(), "utf8")).toBe("Café\nहिन्दी");
  await page.locator("#file").setInputFiles({ name:"bad.txt", mimeType:"text/plain", buffer:Buffer.from([0xff,0xfe]) });
  await expect(page.locator("#notice")).toContainText("UTF-8"); await expect(result(page)).toHaveText("Café\nहिन्दी");
  await page.locator("#file").setInputFiles({ name:"binary.txt", mimeType:"text/plain", buffer:Buffer.from([65,0,66]) });
  await expect(page.locator("#notice")).toContainText("plain-text");
  await page.locator("#file").setInputFiles({ name:"big.txt", mimeType:"text/plain", buffer:Buffer.alloc(410000,65) });
  await expect(page.locator("#notice")).toContainText("too large");
});

test("a slow file read cannot overwrite text typed while it was loading", async ({ page }) => {
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function() {
      await new Promise(resolve => { window.finishFileRead = resolve; });
      return read.call(this);
    };
  });
  await page.locator("#file").setInputFiles({ name:"slow.txt", mimeType:"text/plain", buffer:Buffer.from("old") });
  await input(page).fill("my latest edit");
  await page.evaluate(() => window.finishFileRead());
  await expect(result(page)).toHaveText("my latest edit"); await expect(input(page)).toHaveValue("my latest edit");
});

test("counts and an active limit can switch between the original and the result", async ({ page }) => {
  await button(page, "Tidy a list").click(); await input(page).fill("Ink\nInk\nPaper");
  await expect(page.locator('[data-stat="words"]')).toHaveText("2");
  await button(page, "Set a limit").click(); await page.getByLabel("Maximum").fill("2"); await button(page, "Apply").click();
  await expect(page.locator("#limit-status")).toContainText("Exactly");
  await page.getByRole("combobox", { name:"Text to count" }).selectOption("original");
  await expect(page.locator('[data-stat="words"]')).toHaveText("3");
  await expect(page.locator("#limit-status")).toHaveText("1 word over the limit.");
  await expect(result(page)).toHaveText("Ink\nPaper");
});

test("steps files preview before import, handle conflicting names, and omit pasted text", async ({ page }) => {
  await input(page).fill("private meeting notes");
  await nameSteps(page, "Spacing"); await button(page, "Save steps").click();
  await dialog(page).getByText("Move steps to another browser").click();
  const download = page.waitForEvent("download"); await button(page, "Download steps file").click();
  const file = await download, bytes = await fs.readFile(await file.path());
  const decoded = JSON.parse(bytes.toString("utf8"));
  expect(decoded.version).toBe(1); expect(decoded.name).toBe("Spacing"); expect(bytes.toString("utf8")).not.toContain("private");
  const pick = data=>page.locator("#steps-file").setInputFiles({name:"steps.json",mimeType:"application/json",buffer:Buffer.from(data)});
  await pick('{"version":99}'); await expect(page.locator("#dialog-notice")).toContainText("Choose a steps file");
  await pick(bytes); await expect(page.getByRole("heading",{name:"Import saved steps"})).toBeVisible();
  await button(page,"Save steps").click(); await expect(page.locator("#dialog-notice")).toContainText("already in use");
  await page.getByRole("textbox",{name:"Name",exact:true}).fill("Imported spacing");
  await button(page,"Save steps").click(); await expect(button(page,"Use Imported spacing")).toBeVisible();
  await button(page,"Use Imported spacing").click(); await expect(input(page)).toHaveValue("private meeting notes");
});

test("an imported replacement shows its words before saving and only runs when used", async ({ page }) => {
  await input(page).fill("the draft");
  await button(page, "Saved steps").click();
  await dialog(page).getByText("Move steps to another browser").click();
  const record = { app:"utextility", version:1, name:"Publish", steps:[{id:"replace",find:"draft",replacement:"report"}] };
  await page.locator("#steps-file").setInputFiles({ name:"publish.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#save-hint")).toHaveText("Replace “draft” with “report”");
  await button(page, "Save steps").click();
  await expect(button(page, "Use Publish")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(result(page)).toHaveText("the draft");
  await button(page, "Saved steps").click(); await button(page, "Use Publish").click();
  await expect(result(page)).toHaveText("the report"); await expect(input(page)).toHaveValue("the draft");
});

test("copy confirms a successful write and selects the full text on permission denial", async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable:true, value:{ writeText:async value=>{
    if (window.denyCopy) throw new DOMException("Denied","NotAllowedError");
    window.copiedText = value;
  } } }));
  await input(page).fill(" Fresh   copy "); await expect(result(page)).toHaveText("Fresh copy");
  await button(page, "Copy result").click(); await expect(page.locator("#notice")).toHaveText("Result copied.");
  expect(await page.evaluate(()=>window.copiedText)).toBe("Fresh copy");
  await button(page, "Changes").click(); await page.evaluate(()=>{window.denyCopy=true;});
  await button(page, "Copy result").click(); await expect(page.locator("#notice")).toContainText("selected");
  expect(await page.evaluate(()=>window.getSelection().toString())).toBe("Fresh copy");
});

test("large jobs use a worker, bound highlighting, reject oversized input and recover", async ({ page }) => {
  const worker = page.waitForEvent("worker");
  await input(page).fill("Ink  ".repeat(20000)); await worker;
  await expect(button(page, "Copy result")).toBeEnabled();
  await expect(page.locator('[data-stat="words"]')).toHaveText("20,000");
  await button(page, "Changes").click(); await expect(page.locator("#changes")).toContainText("too long to highlight");
  await input(page).fill("q".repeat(100001)); await expect(page.locator("#changes")).toContainText("too long for one edit");
  await expect(button(page, "Copy result")).toBeDisabled();
  await input(page).fill("  Fresh   edit "); await button(page, "Text").click();
  await expect(result(page)).toHaveText("Fresh edit");
});

test("the folder works directly from disk and the HTTP app makes only local requests", async ({ page, baseURL }) => {
  const urls=[]; page.on("request", req=>urls.push(req.url()));
  await page.reload(); await button(page, "Try an example").click(); await button(page, "More tools").click();
  await page.keyboard.press("Escape"); await button(page, "Use dark mode").click();
  expect(urls.every(url=>new URL(url).origin===new URL(baseURL).origin)).toBe(true);
  await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
  await input(page).fill(" One   local\neditor. "); await expect(result(page)).toHaveText("One local editor.");
  await button(page, "Make link names").click(); await expect(result(page)).toHaveText("one-local\neditor");
});

test("a late result cannot overwrite a newer edit or enable copying stale text", async ({ page }) => {
  await page.evaluate(() => {
    window.Worker = class {
      postMessage(job) { window.releaseOldResult = () => this.onmessage({data: ProofTools.evaluateJob(job)}); }
    };
  });
  await input(page).fill("old  ".repeat(1200));
  await page.waitForFunction(() => typeof window.releaseOldResult === "function");
  await input(page).fill("new   edit");
  await page.evaluate(() => window.releaseOldResult());
  expect(await result(page).textContent()).not.toContain("old");
  await expect(result(page)).toHaveText("new edit");
  await expect(button(page, "Copy result")).toBeEnabled();
});

for (const failure of ["construction", "loading"]) {
  test("large text still works after a worker " + failure + " failure", async ({ page }) => {
    await page.evaluate(mode => {
      window.Worker = class {
        constructor() { if (mode === "construction") throw new Error("Blocked worker"); }
        postMessage() { setTimeout(() => this.onerror(new Event("error")), 0); }
        terminate() {}
      };
    }, failure);
    await input(page).fill("print   ".repeat(600));
    await expect(page.locator('[data-stat="words"]')).toHaveText("600");
    await expect(button(page, "Copy result")).toBeEnabled();
    await input(page).fill("another  paragraph");
    await expect(result(page)).toHaveText("another paragraph");
  });
}

test("pasted markup is plain text and working on it leaves no stored draft", async ({ page, context }) => {
  const text = "<b>Private notes</b>   for Thursday";
  await input(page).fill(text);
  await expect(result(page)).toHaveText("<b>Private notes</b> for Thursday");
  await expect(result(page).locator("b")).toHaveCount(0);
  await button(page, "Changes").click();
  await expect(page.locator("#changes b")).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0,0]);
  expect(await context.cookies()).toEqual([]);
  await page.reload(); await expect(input(page)).toHaveValue("");
});
