const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const button = (page, name) => page.getByRole("button", { name, exact: true });
const lesson = (page, id) => page.locator("#lesson-list").locator('[data-section="' + id + '"]');
const field = (page, name) => page.locator("#practice-form").getByLabel(name, { exact: true });

test.afterEach(async ({ page }) => {
  expect((await page.pageErrors()).map(error => error.message)).toEqual([]);
});

test("the guide and browser history preserve an editor draft, settings and caret in memory", async ({ page }) => {
  await page.goto("/");
  await button(page, "Find and replace").click();
  await page.locator("#source").fill("private draft from the desk");
  await page.getByLabel("Find", { exact: true }).fill("draft");
  await page.getByLabel("Replace with", { exact: true }).fill("proof");
  await button(page, "Changes").click();
  await button(page, "Set a limit").click();
  await page.getByLabel("Maximum", { exact: true }).fill("5");
  await button(page, "Apply").click();
  await page.locator("#source").focus();
  await page.locator("#source").evaluate(el => el.setSelectionRange(3,9));
  await page.locator("#nav-guide").click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", {level:1})).toHaveText("Quick guide.");
  await expect(page.locator("#guide-title")).toBeFocused();
  await expect(page.locator("#desk")).toBeHidden();
  await lesson(page, "list").click();
  await page.locator("#practice-source").fill("unrelated practice");
  await page.locator("#run-lesson").click();
  await page.goBack();
  await expect(page.locator("#source")).toHaveValue("private draft from the desk");
  await expect(page.locator("#source")).toBeFocused();
  expect(await page.locator("#source").evaluate(el => [el.selectionStart,el.selectionEnd])).toEqual([3,9]);
  await expect(page.getByLabel("Find", { exact: true })).toHaveValue("draft");
  await expect(button(page, "Changes")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("#limit-status")).toContainText("Exactly");
  await page.goForward();
  await expect(page.locator("#practice-source")).toHaveValue("unrelated practice");
  expect(await page.evaluate(() => JSON.stringify([history.state,location.href,localStorage,sessionStorage]))).not.toMatch(/private draft|unrelated practice/);
  await page.locator("#nav-editor").click();
  await expect(page.locator("#changes")).toContainText("proof");
  await button(page, "More tools").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#guide-page")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("all six lessons run real edits, update on input, reset and remember tried lessons", async ({ page }) => {
  await page.goto("/guide");
  const run = () => page.locator("#run-lesson").click();
  const output = page.locator("#practice-result"), note = page.locator("#practice-feedback");
  await run();
  await expect(output).toContainText("The bookshop opens at noon.");
  await field(page, "Keep my line breaks").check();
  expect(await output.textContent()).toContain("opens\nat noon.");
  await lesson(page, "list").click();
  await run();
  await expect(note).toContainText("4 items");
  await field(page, "Treat “Paper” and “paper” as the same item").check();
  expect(await output.textContent()).toBe("Paper\nInk\nCopper plate");
  await lesson(page, "links").click();
  await run();
  await expect(note).toContainText("lines 1 and 3");
  await page.locator("#practice-source").fill("Café Notes\nReading Room");
  expect(await output.textContent()).toBe("café-notes\nreading-room");
  await expect(note).toContainText("its own");
  await lesson(page, "replace").click();
  await run();
  await expect(note).toHaveText("2 exact matches.");
  await field(page, "Replace with").fill("");
  await expect(output).not.toContainText("draft");
  await lesson(page, "limit").click();
  await run();
  await expect(note).toHaveText("2 words over the limit.");
  await field(page, "Maximum").fill("10");
  await expect(note).toHaveText("Exactly at the limit.");
  await field(page, "Count").selectOption("characters");
  await expect(note).toContainText("characters over");
  await lesson(page, "sequence").click();
  await run();
  expect(await output.textContent()).toBe("ink\npaper");
  await field(page, "First step").selectOption("dedupe");
  expect(await output.textContent()).toBe("ink\nink\npaper");
  await expect(page.locator("#tried-count")).toHaveText("6 of 6 tried");
  await lesson(page, "links").click();
  await expect(page.locator("#practice-source")).toHaveValue("Café Notes\nReading Room");
  await button(page, "Reset example").click();
  await expect(output).toContainText("Run the example");
  await expect(page.locator("#practice-source")).toHaveValue(/Summer-Reading/);
  await expect(page.locator("#practice-announcement")).toHaveText("Practice example reset.");
  await expect(page.locator("#tried-meter")).toHaveJSProperty("value",6);
});

test("the live tool index covers every engine operation and can apply a tool to the existing editor text", async ({ page }) => {
  await page.goto("/");
  await page.locator("#source").fill("Ink And Paper");
  await page.locator("#nav-guide").click();
  await page.getByRole("navigation",{ name: "Guide contents" }).getByRole("link",{ name: "Tool index" }).click();
  await expect(page.locator("#index-title")).toBeFocused();
  const select = page.locator("#index-choice");
  const ids = await select.locator("option").evaluateAll(options => options.map(option => option.value));
  const engineIds = await page.evaluate(() => ProofTools.tools.map(tool => tool.id));
  expect(ids.slice().sort()).toEqual(engineIds.sort());
  for (const id of ids) {
    await select.selectOption(id);
    await expect(page.locator("#index-before")).not.toBeEmpty();
    await expect(page.locator("#index-after")).not.toBeEmpty();
    await expect(page.locator("#index-description")).not.toBeEmpty();
  }
  await select.selectOption("snake");
  await expect(page.locator("#index-after")).toHaveText("book_club_notes");
  await button(page, "Use this tool in the editor").click();
  await expect(page.locator("#source")).toBeFocused();
  await expect(page.locator("#source")).toHaveValue("Ink And Paper");
  await expect(page.locator("#proof")).toHaveText("ink_and_paper");
  await expect(page.locator("#step-summary")).toContainText("snake_case");
  await page.locator("#tool-guide").click();
  await expect(page).toHaveURL(/\/guide#tool-snake$/);
  await expect(select).toHaveValue("snake");
  await select.selectOption("number");
  await expect(page).toHaveURL(/\/guide#tool-number$/);
  await page.reload();
  await expect(select).toHaveValue("number");
  await expect(page.locator("#index-title")).toBeFocused();
});

test("empty practice text and missing settings give a recoverable next step", async ({ page }) => {
  await page.goto("/guide#replace");
  const sample = page.getByLabel("Practice text", { exact: true });
  const find = field(page, "Find");
  const run = page.locator("#run-lesson");
  await sample.fill("");
  await run.click();
  await expect(sample).toBeFocused();
  await expect(page.locator("#tried-count")).toHaveText("0 of 6 tried");
  await sample.fill("draft");
  await find.fill("");
  await run.click();
  await expect(find).toBeFocused();
  await find.fill("draft");
  await field(page, "Replace with").fill("");
  await run.click();
  await expect(page.locator("#practice-result")).toHaveText("These steps removed all the text.");
  await expect(page.locator("#practice-feedback")).toHaveText("1 exact match.");
  await sample.fill("");
  await expect(page.locator("#practice-result")).toContainText("Type some practice text");
  await expect(page.locator("#practice-feedback")).toBeEmpty();
  await lesson(page, "limit").click();
  await run.click();
  await field(page, "Maximum").fill("0");
  await expect(page.locator("#practice-feedback")).toContainText("whole-number maximum");
  await field(page, "Maximum").fill("10");
  await expect(page.locator("#practice-feedback")).toHaveText("Exactly at the limit.");
});

test("direct guide links, keyboard navigation, reference topics and theme work together", async ({ page }) => {
  await page.goto("/guide#replace");
  await expect(page.locator("#lesson-title")).toBeFocused();
  await expect(page.locator("#lesson-title")).toHaveText("Replace a phrase");
  await page.reload();
  await expect(page.locator("#lesson-title")).toHaveText("Replace a phrase");
  await page.goto("/guide");
  await page.keyboard.press("Tab");
  await expect(page.locator("#skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#guide-title")).toBeFocused();
  await button(page, "Use dark mode").click();
  await page.getByRole("navigation",{ name: "Guide contents" }).getByRole("link",{ name: "Editor help" }).click();
  await expect(page.locator("#help-title")).toBeFocused();
  const topic = page.getByText("Move saved steps to another browser",{ exact: true });
  await topic.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".help-topics details[open]")).toContainText("Open steps file");
  await page.locator("#nav-editor").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await button(page, "Make link names").click();
  await page.locator("#tool-guide").click();
  await expect(page).toHaveURL(/\/guide#links$/);
  await expect(page.locator("#lesson-title")).toHaveText("Make link names");
});

test("the direct-file guide works offline and returns to the draft", async ({ page, context }) => {
  const url = pathToFileURL(path.resolve(__dirname,"../../index.html")).href;
  await context.setOffline(true);
  await page.goto(url + "#guide-list");
  await expect(page.locator("#lesson-title")).toHaveText("Tidy a list");
  await page.locator("#run-lesson").click();
  await expect(page.locator("#practice-feedback")).toContainText("4 items");
  await page.locator("#nav-editor").click();
  await page.locator("#source").fill(" Words  on paper ");
  await page.locator("#tool-guide").click();
  await expect(page).toHaveURL(/#guide-clean$/);
  await page.goBack();
  await expect(page.locator("#proof")).toHaveText("Words on paper");
});

test("phones can choose a lesson, read its result and jump back to editing with large targets", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/guide");
  await expect(page.getByLabel("Choose a practice lesson")).toBeVisible();
  await page.locator("#lesson-choice").selectOption("replace");
  await page.locator("#run-lesson").click();
  await expect(page.locator("#practice-result")).toBeFocused();
  await expect(page.locator("#practice-result")).toBeInViewport();
  await page.locator("#nav-editor").click();
  await page.locator("#source").fill("  17 Paper Street\n  Second floor");
  await page.getByLabel("Keep my line breaks").check();
  await expect(page.locator("#proof")).toHaveText("17 Paper Street\nSecond floor");
  await page.getByRole("link",{ name: "View result" }).click();
  await expect(page.locator("#proof-title")).toBeFocused();
  await page.getByRole("link",{ name: "Back to my text" }).click();
  await expect(page.locator("#source")).toBeFocused();
  for (const id of ["#nav-guide", "#theme", "#tool-guide"]) {
    const box = await page.locator(id).boundingBox();
    expect(Math.round(box.height), id).toBeGreaterThanOrEqual(44);
  }
});

test("the guide and expanded help fit narrow, short, wide and doubled-text layouts", async ({ page }) => {
  await page.goto("/guide#replace");
  const layouts = [[320, 568, 100], [667, 375, 100], [768, 1024, 100], [1440, 900, 100],
    [960, 750, 200], [390, 844, 150], [320, 568, 200]];
  for (const [width, height, font] of layouts) {
    await page.setViewportSize({ width, height });
    await page.evaluate(size => { document.documentElement.style.fontSize = size + "%"; }, font);
    await page.locator(".help-topics details").last().evaluate(details => { details.open = true; });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const controls = document.querySelectorAll("header a, header button, #guide-page :is(a,button,input,textarea,select,summary)");
      const outside = Array.from(controls).filter(control => {
        const box = control.getBoundingClientRect();
        return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1);
      }).map(control => control.id || control.textContent);
      return { wide: document.documentElement.scrollWidth > innerWidth + 1, outside };
    });
    expect(overflow, width + "px with " + font + "% text").toEqual({ wide: false, outside: [] });
  }
});

test("the editor remembers quick options in the tab and exposes limit usage", async ({ page }) => {
  await page.goto("/");
  await page.locator("#source").fill("  Paper Street\n Upper floor ");
  await page.getByLabel("Keep my line breaks").check();
  expect(await page.locator("#source").inputValue()).toContain("  Paper");
  await expect(page.locator("#proof")).toHaveText("Paper Street\nUpper floor");
  await button(page, "Tidy a list").click();
  await page.getByRole("checkbox").check();
  await button(page, "Clean up text").click();
  await expect(page.getByLabel("Keep my line breaks")).toBeChecked();
  await button(page, "Tidy a list").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await button(page, "Set a limit").click();
  await page.getByLabel("Maximum",{ exact: true }).fill("3");
  await button(page, "Apply").click();
  await expect(page.getByRole("progressbar",{ name: "Limit used"})).toHaveAttribute("aria-valuetext","4 of 3 words");
  await button(page, "Edit limit").click();
  await button(page, "Remove").click();
  await expect(page.locator("#limit-meter")).toBeHidden();
});

test("automated accessibility checks cover lessons, examples and open help in both themes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/guide");
  await page.addScriptTag({path:require.resolve("axe-core/axe.min.js")});
  const findings = [];
  async function scan(state) {
    const issues = await page.evaluate(async () => {
      const result = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }
      });
      return result.violations.map(issue => ({ rule: issue.id, targets: issue.nodes.map(node => node.target) }));
    });
    if (issues.length) findings.push({ state, issues });
  }
  await scan("cover");
  for (const id of ["clean", "list", "links", "replace", "limit", "sequence"]) {
    await lesson(page,id).click();
    await page.locator("#run-lesson").click();
    await scan(id);
  }
  await button(page, "Use dark mode").click();
  await page.setViewportSize({width:390,height:844});
  await page.locator("#lesson-choice").selectOption("replace");
  await page.locator(".help-topics details").first().evaluate(el => el.open=true);
  await page.locator("#index-choice").selectOption("replace");
  await scan("dark phone with help and example");
  expect(findings).toEqual([]);
});
