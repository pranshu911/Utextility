const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const engine = require("../engine.js");
const { runRecipe, metrics, differences, recipes } = engine;

const contracts = [
  ["trim", "  one\n\ttwo\u00a0", "one\ntwo"],
  ["spaces", "one\u00a0\t two\nthree", "one two\nthree"],
  ["unwrap", "one \n two\n\n- three\n- four\n\nlast\nline", "one two\n\n- three\n- four\n\nlast line"],
  ["join", "a\r\n\r\nb", "a  b"],
  ["separators", "a-b_c\nd-e", "a b c\nd e"],
  ["punctuation", "Ready? “Yes!” ₹5。", "Ready Yes ₹5"],
  ["quotes", "‘One’ “Two”", "'One' \"Two\""],
  ["blanks", "A\n  \nB\n", "A\nB"],
  ["dedupe", "B\nA\nB\na", "B\nA\na"],
  ["dedupe-fold", "Ink\nPAPER\nink\nPaper\nCafé\nCAFE\u0301\nCafe", "Ink\nPAPER\nCafé\nCafe"],
  [{ id: "replace", find: ".", replacement: "$&" }, "a.b.", "a$&b$&"],
  ["sort", "row10\nrow2\nrow1", "row1\nrow2\nrow10"],
  ["upper", "ab\nCd", "AB\nCD"],
  ["lower", "AB\nCd", "ab\ncd"],
  ["capital", "hELLO  wORLD\nDON’T", "Hello  World\nDon’t"],
  ["title", "the art of PRINTING\nthe end of", "The Art of Printing\nThe End Of"],
  ["invert", "aB-4", "Ab-4"],
  ["alternate", "ABC 12 def", "aBc 12 DeF"],
  ["snake", "HTTPResponse Café / हिन्दी", "http_response_café_हिन्दी"],
  ["kebab", " ---Café + Type!?\nनया शीर्षक", "café-type\nनया-शीर्षक"],
  ["camel", "http-response CODE", "httpResponseCode"],
  ["pascal", "file_name\nHTTPResponse", "FileName\nHttpResponse"],
  ["reverse-words", "one  👩🏽‍💻e\u0301\ntwo", "eno  e\u0301👩🏽‍💻\nowt"],
  ["reverse", "A😀e\u0301", "e\u0301😀A"],
  ["number", "001042", "One Thousand Forty Two"],
];
for (const [step, input, expected] of contracts) {
  test(engine.stepId(step) + " follows its tool description", () => assert.equal(runRecipe(input, [step]), expected));
}
test("every indexed tool has a regression example", () => {
  assert.deepEqual(contracts.map(row => engine.stepId(row[0])).sort(), engine.tools.map(tool => tool.id).sort());
});
test("all four quick tools have a reproducible example", () => {
  const outputs = [
    "Good type is easy to read, but hard to set.\n\nA second proof catches what the first one missed.",
    "Indigo ink\nCopper plate\nCotton paper",
    "notes-from-the-print-room\ncafé-type\nhttp-response-codes\nहिन्दी-पाठ",
    "The report is ready. Read the report before Friday.",
  ];
  assert.deepEqual(recipes.map(recipe => runRecipe(recipe.example, recipe.exampleSteps || recipe.steps)), outputs);
});
test("step order matters and a recipe leaves its input available", () => {
  const source = " Ink\nInk";
  assert.equal(runRecipe(source, ["trim", "dedupe"]), "Ink");
  assert.equal(runRecipe(source, ["dedupe", "trim"]), "Ink\nInk");
  assert.equal(runRecipe(source, []), source);
});
test("blank lines, list markers and single newlines are distinct", () => {
  assert.equal(runRecipe("\nAlpha\nBeta\n\n1. First\n2. Second\n\n", ["unwrap"]), "\nAlpha Beta\n\n1. First\n2. Second\n\n");
  assert.equal(runRecipe("\n", ["unwrap"]), "\n");
  assert.equal(metrics("a\n\nb\n").lines, 4);
  assert.equal(metrics("").lines, 0);
});
test("graphemes and words are counted separately", () => {
  assert.equal(metrics("👩🏽‍💻e\u0301").characters, 2);
  assert.equal(metrics("नमस्ते दुनिया").words, 2);
  assert.equal(metrics(" \t\n").sentences, 0);
  assert.equal(metrics("Hello. Again!").sentences, 2);
  assert.equal(metrics("word ".repeat(200)).seconds, 60);
});
test("number spelling respects the original inclusive limit and blocks invalid output", () => {
  for (const [input, result] of [["0", "Zero"], ["100", "One Hundred"], ["999999", "Nine Hundred Ninety Nine Thousand Nine Hundred Ninety Nine"], ["1000000", "One Million"]]) {
    assert.equal(runRecipe(input, ["number"]), result);
  }
  for (const input of ["1000001", "-1", "1.5", "1e6", "abc"]) assert.throws(() => runRecipe(input, ["number"]), /Step 1.*whole number/);
  assert.equal(runRecipe("", ["number"]), "");
});
test("comparison reconstructs both exact strings including whitespace", () => {
  for (const [a, b] of [["one  two\n", "one two "], ["A👩🏽‍💻\t", "हिन्दी!\n"], ["", "hello"], ["hello", ""], ["a a a", " a b"]]) {
    const { parts } = differences(a, b);
    assert.equal(parts.filter(part => part.kind !== "added").map(part => part.value).join(""), a);
    assert.equal(parts.filter(part => part.kind !== "removed").map(part => part.value).join(""), b);
  }
  assert.equal(differences("same", "same").identical, true);
  assert.equal(differences("ab ".repeat(600), "ac ".repeat(600)).large, true);
  assert.equal(differences("x".repeat(32_001), "y").large, true);
});
test("limits reject oversize work and allow the boundary", () => {
  assert.equal(runRecipe("a".repeat(engine.maxSourceLength), ["upper"]).length, engine.maxSourceLength);
  assert.throws(() => runRecipe("a".repeat(engine.maxSourceLength + 1), []), /100,000/);
  assert.throws(() => runRecipe("x", Array(17).fill("lower")), /16/);
  assert.throws(() => runRecipe("x", ["missing"]), /unknown step/);
});
test("browsers without Segmenter label approximate counts and protect complex reversals", () => {
  const intl = Object.create(Intl);
  Object.defineProperty(intl, "Segmenter", { value: undefined });
  const context = { Intl: intl };
  vm.runInNewContext(fs.readFileSync(require.resolve("../engine.js"), "utf8"), context);
  const fallback = context.ProofTools;
  assert.equal(fallback.metrics("😀").approximate, true);
  assert.equal(fallback.metrics("😀").characters, 1);
  assert.equal(fallback.runRecipe("abc", ["reverse"]), "cba");
  assert.throws(() => fallback.runRecipe("👩🏽‍💻", ["reverse"]), /newer browser/);
});

test("prose cleanup leaves fenced code and its indentation intact", () => {
  const fence = ["~~~js", "    print('two  spaces')", "", "  return  1;", "~~~"].join("\n");
  const source = " Before   this\nparagraph.\n" + fence + "\n After\nthis. ";
  assert.equal(runRecipe(source, recipes[0].steps), "Before this paragraph.\n" + fence + "\nAfter this.");
  const backticks = ["  ````js", "    const x = 'two  spaces';", "```", "  keep  these   spaces", "  ````"].join("\n");
  assert.equal(runRecipe(" Before\nhere.\n" + backticks + "\n Two   words", recipes[0].steps), "Before here.\n" + backticks + "\nTwo words");
  assert.equal(runRecipe("x\n~~~\n  unfinished   code ", recipes[0].steps), "x\n~~~\n  unfinished   code ");
  assert.equal(runRecipe(">quote\n# Title\n| X | Y |\n---\nA\nB", ["unwrap"]), ">quote\n# Title\n| X | Y |\n---\nA B");
});
test("replacement counts refer to the text entering each step", () => {
  const a = { id: "replace", find: "ab", replacement: "cc" }, b = { id: "replace", find: "c", replacement: "" };
  const result = engine.evaluate("AB ab!", ["lower", a, b], true);
  assert.equal(result.proof, " !");
  assert.deepEqual(result.counts, { 1: 2, 2: 4 });
  assert.equal(engine.evaluate("", [a]).counts[0], 0);
  assert.equal(engine.evaluate("ab", [{ ...a, find: "" }]).counts[0], null);
});
test("literal replacement handles newlines, quotes, overlapping matches and emoji", () => {
  assert.equal(runRecipe("aaa", [{ id: "replace", find: "aa", replacement: "b" }]), "ba");
  assert.equal(runRecipe("a\nb\n😀", [{ id: "replace", find: "\nb\n", replacement: "$$\"😀" }]), 'a$$"😀😀');
  assert.equal(runRecipe("x", [{ id: "replace", find: "", replacement: "a" }]), "x");
});
test("replacement size is checked before materializing an expanded result", () => {
  const step = { id: "replace", find: "a", replacement: "a".repeat(1000) };
  assert.equal(runRecipe("a".repeat(300), [step]).length, 300000);
  assert.throws(() => runRecipe("a".repeat(301), [step]), /result would be too long/);
  for (const invalid of ["replace", { id: "replace", find: "a" }, { ...step, find: "a".repeat(1001) }]) {
    assert.equal(engine.validStep(invalid), false);
    assert.throws(() => runRecipe("a", [invalid]), /invalid settings/);
  }
});
test("a repeated link notice names result lines after blank lines are removed", () => {
  const result = engine.evaluate("Ink Lab\n\nInk-Lab\nOther", ["kebab", "blanks"]);
  assert.deepEqual(result.repeatedLink, [1, 2]);
  assert.equal(result.proof, "ink-lab\nink-lab\nother");
  assert.equal(engine.evaluate("ink\nink", ["dedupe"]).repeatedLink, null);
  assert.equal(engine.evaluate("red\nblue", ["kebab"]).repeatedLink, null);
});
test("original counts are available when a tool changes length or cannot produce a result", () => {
  const job = { source: "Ink\nInk", steps: ["dedupe"], version: 4, countOriginal: true, compare: false };
  assert.equal(engine.evaluateJob(job).result.stats.words, 2);
  assert.equal(engine.evaluateJob({ ...job, countOriginal: false }).result.stats.words, 1);
  const rejected = engine.evaluateJob({ ...job, steps: ["number"] });
  assert.match(rejected.error, /whole number/); assert.equal(rejected.stats.words, 2);
});
