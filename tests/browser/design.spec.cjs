const { test, expect } = require("@playwright/test");
const button = (page, name) => page.getByRole("button", { name, exact: true });

async function checkWidth(page, state) {
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    const overflowing = Array.from((dialog || document).querySelectorAll("button,select,textarea,input:not([hidden]),summary")).filter(el=>{
      const box = el.getBoundingClientRect();
      return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1);
    }).map(el=>el.getAttribute("aria-label") || el.textContent || el.id);
    return { viewport:innerWidth, width:document.documentElement.scrollWidth, overflowing,
      dialogOverflow:dialog ? dialog.scrollWidth - dialog.clientWidth : 0 };
  });
  expect(layout.width, state).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.overflowing, state).toEqual([]);
  expect(layout.dialogOverflow, state).toBeLessThanOrEqual(1);
}

test("controls fit the viewport from 320 to 1440 pixels and with doubled text", async ({ page }) => {
  await page.goto("/");
  for (const [width,height] of [[320,568],[390,844],[667,375],[768,1024],[1024,768],[1440,900]]) {
    await page.setViewportSize({width,height});
    await button(page,"Find and replace").click(); await checkWidth(page, "editor " + width);
    await button(page,"Edit steps").click(); await checkWidth(page, "step editor " + width);
    await page.keyboard.press("Escape"); await button(page,"Saved steps").click();
    await page.getByRole("dialog").getByText("Move steps to another browser", { exact:true }).click(); await checkWidth(page, "saved steps " + width);
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 960, height: 750 });
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  await checkWidth(page, "200% text");
  await button(page,"Edit steps").click(); await checkWidth(page, "200% dialog text");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width:320, height:568 });
  await checkWidth(page, "200% text on a small phone");
});

test("mobile editing has a result jump and large primary touch targets", async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto("/");
  await button(page,"Try an example").click();
  for (const name of ["Copy result","Download","More tools","Open file","Try an example"]) {
    const box=await button(page,name).boundingBox();
    expect(Math.round(box.height * 100) / 100,name).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.width * 100) / 100,name).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("link",{name:"View result"}).click(); await expect(page.locator("#proof-title")).toBeFocused();
  await expect(page.locator("#proof")).toBeInViewport();
});

test("keyboard access includes skip link, search, dialog dismissal and return focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab"); await expect(page.getByRole("link",{name:"Skip to text editor"})).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.locator("#source")).toBeFocused();
  await button(page,"More tools").focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("uppercase"); await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  for(let i=0;i<7;i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(()=>Boolean(document.activeElement.closest("main,header")))).toBe(false);
  }
  await page.keyboard.press("Escape"); await expect(button(page,"More tools")).toBeFocused();
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("appearance follows system preference until the user makes a choice", async ({ page }) => {
  await page.emulateMedia({colorScheme:"dark"}); await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await button(page,"Use light mode").click(); await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
});

test("automated accessibility scan covers both themes and the main interactive states", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/"); await page.addScriptTag({path:require.resolve("axe-core/axe.min.js")});
  const findings=[];
  async function scan(state) {
    const rows=await page.evaluate(async ()=>{
      const result=await axe.run(document,{runOnly:{type:"tag", values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"]}});
      return result.violations.map(v=>({rule:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));
    });
    if(rows.length) findings.push({state,rows});
  }
  await scan("blank editor");
  await button(page,"Try an example").click(); await button(page,"Changes").click(); await scan("changes");
  await button(page,"Tidy a list").click(); await scan("list options");
  await button(page,"Find and replace").click(); await scan("replacement fields");
  await button(page,"Set a limit").click(); await scan("limit form");
  await button(page,"Use dark mode").click(); await scan("dark editor");
  await button(page,"More tools").click(); await scan("tool library");
  await page.getByRole("dialog").locator("summary").filter({hasText:"Edit current steps"}).click(); await scan("edit steps");
  await button(page,"Save these steps").click(); await scan("name form");
  await page.keyboard.press("Escape"); await button(page,"Saved steps").click();
  await page.getByRole("dialog").getByText("Move steps to another browser", { exact:true }).click(); await scan("saved steps and files");
  expect(findings).toEqual([]);
});
