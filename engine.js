/* Shared by the workbench, the browser worker and the Node regression suite. */
(() => {
  "use strict";

  const maxSourceLength = 100_000;
  const maxResultLength = 300_000;
  const maxFieldLength = 1_000;
  const maxSteps = 16;
  const segmenters = new Map();
  const lineCollator = new Intl.Collator("en", { numeric: true, sensitivity: "variant" });
  const minorWords = new Set("a an and as at but by for from in nor of on or the to with".split(" "));
  const listComparison = new Intl.Collator(undefined, { sensitivity: "accent" });
  const structuredLine = /^\s*(?:[-*+•‣]\s|\d+[.)]\s|#{1,6}(?:\s|$)|>|\||(?:-{3,}|\*{3,}|_{3,})\s*$)/u;

  function segmenter(granularity) {
    if (typeof Intl.Segmenter !== "function") return null;
    if (!segmenters.has(granularity)) {
      segmenters.set(granularity, new Intl.Segmenter(undefined, { granularity }));
    }
    return segmenters.get(granularity);
  }

  function graphemes(text) {
    const splitter = segmenter("grapheme");
    return splitter ? Array.from(splitter.segment(text), part => part.segment) : Array.from(text);
  }

  function countSegments(splitter, text, include) {
    let count = 0;
    for (const part of splitter.segment(text)) {
      if (!include || include(part)) count++;
    }
    return count;
  }

  function metrics(text) {
    let words, sentences, characters;
    const approximate = !segmenter("word");
    if (approximate) {
      words = (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) || []).length;
      characters = Array.from(text).length;
      sentences = text.split(/[.!?。！？]+/u).filter(piece => /[\p{L}\p{N}]/u.test(piece)).length;
    } else {
      words = countSegments(segmenter("word"), text, part => part.isWordLike);
      characters = countSegments(segmenter("grapheme"), text);
      sentences = countSegments(segmenter("sentence"), text, part => /[\p{L}\p{N}]/u.test(part.segment));
    }
    const lines = text ? text.split(/\r\n|[\n\r]/u).length : 0;
    return { words, characters, lines, sentences, seconds: Math.ceil(words * 60 / 200), approximate };
  }

  function linesOf(text, convert) {
    return text.split("\n").map(convert).join("\n");
  }

  // Keep the contents of Markdown code fences intact during prose cleanup.
  function outsideCode(text, transform) {
    const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/u;
    if (!/(?:^|\n) {0,3}(?:`{3,}|~{3,})/u.test(text)) return transform(text);
    const output = [], prose = [];
    let fence = "";
    function flush() {
      if (prose.length) output.push(transform(prose.join("\n")));
      prose.length = 0;
    }
    for (const line of text.split("\n")) {
      const marker = fencePattern.exec(line);
      if (fence) {
        output.push(line);
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = "";
      } else if (marker) {
        flush();
        fence = marker[1];
        output.push(line);
      } else prose.push(line);
    }
    flush();
    return output.join("\n");
  }

  function unwrap(text) {
    const pieces = [];
    let previousWasProse = false;
    for (const line of text.split("\n")) {
      const isProse = Boolean(line.trim()) && !structuredLine.test(line);
      if (isProse && previousWasProse) {
        pieces[pieces.length - 1] = pieces[pieces.length - 1].trimEnd();
        pieces.push(" ", line.trimStart());
      } else {
        if (pieces.length) pieces.push("\n");
        pieces.push(line);
      }
      previousWasProse = isProse;
    }
    return pieces.join("");
  }

  function capitalize(word) {
    return word.toLowerCase().replace(/\p{L}/u, first => first.toUpperCase());
  }

  function titleCase(line) {
    const words = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
    const parts = [...line.matchAll(words)];
    let index = 0;
    return line.replace(words, word => {
      const isInterior = index > 0 && index < parts.length - 1;
      index++;
      return isInterior && minorWords.has(word.toLowerCase()) ? word.toLowerCase() : capitalize(word);
    });
  }

  function identifier(line, style) {
    const parts = line.normalize("NFC")
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
      .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, "$1 $2")
      .match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) || [];
    const lower = parts.map(part => part.toLowerCase());
    if (style === "kebab") return lower.join("-");
    if (style === "snake") return lower.join("_");
    return lower.map((word, index) => style === "camel" && index === 0 ? word : capitalize(word)).join("");
  }

  function spellNumber(text) {
    const digits = text.trim();
    if (!/^\d+$/u.test(digits) || Number(digits) > 1_000_000) {
      throw new Error("Enter one whole number from 0 to 1,000,000 using digits only.");
    }
    const value = Number(digits);
    const small = "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen".split(" ");
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function belowThousand(n) {
      if (n < 20) return small[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + small[n % 10] : "");
      return small[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + belowThousand(n % 100) : "");
    }
    if (value === 1_000_000) return "One Million";
    if (value < 1000) return belowThousand(value);
    return belowThousand(Math.floor(value / 1000)) + " Thousand" + (value % 1000 ? " " + belowThousand(value % 1000) : "");
  }

  function alternatingCase(text) {
    let nextUpper;
    return text.replace(/\p{L}/gu, letter => {
      if (letter.toUpperCase() === letter.toLowerCase()) return letter;
      if (nextUpper === undefined) nextUpper = letter === letter.toLowerCase();
      const value = nextUpper ? letter.toUpperCase() : letter.toLowerCase();
      nextUpper = !nextUpper;
      return value;
    });
  }

  function reverse(text) {
    if (!segmenter("grapheme") && /[^\x00-\x7F]/u.test(text)) {
      throw new Error("Try a newer browser to reverse text with accents or emoji safely.");
    }
    return graphemes(text).reverse().join("");
  }

  function removeRepeatedLines(text) {
    const lines = text.split("\n");
    const positions = lines.map((_, index) => index);
    positions.sort((a, b) => listComparison.compare(lines[a], lines[b]) || a - b);
    const repeated = new Set();
    for (let i = 1; i < positions.length; i++) {
      if (listComparison.compare(lines[positions[i - 1]], lines[positions[i]]) === 0) repeated.add(positions[i]);
    }
    return lines.filter((_, index) => !repeated.has(index)).join("\n");
  }

  function replaceText(text, step, recordCount) {
    const find = step.find || "";
    if (!find) return text;
    const replacement = step.replacement;
    let matches = 0;
    for (let start = text.indexOf(find); start !== -1; start = text.indexOf(find, start + find.length)) matches++;
    if (text.length + matches * (replacement.length - find.length) > maxResultLength) {
      throw new Error("The result would be too long. Shorten the replacement or use a smaller section of text.");
    }
    if (recordCount) recordCount(matches);
    return matches ? text.replaceAll(find, () => replacement) : text;
  }

  function tool(id, name, group, description, run) {
    return { id, name, group, description, run };
  }

  const tools = [
    tool("trim", "Trim each line", "Spacing and punctuation", "Remove spaces from the start and end of each line. Keep fenced code as written.", text => outsideCode(text, part => linesOf(part, line => line.trim()))),
    tool("spaces", "Remove extra spaces", "Spacing and punctuation", "Turn repeated spaces or tabs into one space. Keep fenced code as written.", text => outsideCode(text, part => part.replace(/[\t\p{Zs}]+/gu, " "))),
    tool("unwrap", "Join wrapped lines", "Spacing and punctuation", "Join lines within paragraphs. Keep blank lines, marked lists and fenced code apart.", text => outsideCode(text, unwrap)),
    tool("join", "Join all lines", "Spacing and punctuation", "Make one line of text, including across blank lines.", text => text.replace(/\n/gu, " ")),
    tool("separators", "Replace dashes and underscores", "Spacing and punctuation", "Turn dashes and underscores into spaces.", text => text.replace(/[-_]+/gu, " ")),
    tool("punctuation", "Remove punctuation", "Spacing and punctuation", "Keep letters, numbers, currency signs and emoji.", text => text.replace(/\p{P}/gu, "")),
    tool("quotes", "Straighten quotes", "Spacing and punctuation", "Change curly quotes into straight quotes.", text => text.replace(/[‘’]/gu, "'").replace(/[“”]/gu, '"')),
    tool("replace", "Find and replace", "Editing", "Replace an exact word or phrase wherever it appears. Match capital letters as typed.", replaceText),
    tool("blanks", "Remove empty lines", "Lists", "Remove blank lines, including lines that contain only spaces.", text => text.split("\n").filter(line => line.trim()).join("\n")),
    tool("dedupe", "Remove repeated lines", "Lists", "Keep the first copy of each line in its original position.", text => [...new Set(text.split("\n"))].join("\n")),
    tool("dedupe-fold", "Remove repeats in any letter case", "Lists", "Treat Ink and ink as the same item. Keep the first spelling.", removeRepeatedLines),
    tool("sort", "Sort lines A to Z", "Lists", "Sort alphabetically. Item 2 comes before Item 10.", text => text.split("\n").sort(lineCollator.compare).join("\n")),
    tool("upper", "Make uppercase", "Letter case", "Change hello to HELLO.", text => text.toUpperCase()),
    tool("lower", "Make lowercase", "Letter case", "Change HELLO to hello.", text => text.toLowerCase()),
    tool("capital", "Capitalize words", "Letter case", "Capitalize each word and lowercase its remaining letters. Spacing stays in place.", text => text.replace(/[\p{L}][\p{L}\p{M}]*(?:['’][\p{L}\p{M}]+)*/gu, capitalize)),
    tool("title", "English title case", "Letter case", "Capitalize the first and last words of each line and keep common connecting words lowercase inside.", text => linesOf(text, titleCase)),
    tool("invert", "Swap uppercase and lowercase", "Letter case", "Change Hello to hELLO.", text => Array.from(text, ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()).join("")),
    tool("alternate", "Alternate letter case", "Letter case", "Change hello to HeLlO.", alternatingCase),
    tool("kebab", "Join words with hyphens", "Code and links", "Turn Print Room into print-room for a link or kebab-case name. Apply to each line.", text => linesOf(text, line => identifier(line, "kebab"))),
    ...[["snake", "snake_case"], ["camel", "camelCase"], ["pascal", "PascalCase"]]
      .map(([id, name]) => tool(id, name, "Code and links", "Turn Print Room into " + identifier("Print Room", id) + ". Apply to each line.", text => linesOf(text, line => identifier(line, id)))),
    tool("reverse-words", "Reverse letters in words", "Other tools", "Change red ink to der kni.", text => text.replace(/\S+/gu, reverse)),
    tool("reverse", "Reverse all text", "Other tools", "Read the whole text backwards.", reverse),
    tool("number", "Number to words", "Other tools", "Spell a whole number from 0 to 1,000,000 in English.", spellNumber),
  ];

  const recipes = [
    { id: "paste", name: "Clean up text", symbol: "¶", description: "Fix extra spaces and join lines within paragraphs.", steps: ["trim", "spaces", "unwrap"],
      example: "  Good   type is easy to read,\nbut hard to set.  \n\n  A second   proof catches\nwhat the first one missed." },
    { id: "list", name: "Tidy a list", symbol: "≡", description: "Remove blank lines and repeated items. Keep the original order.", steps: ["trim", "blanks", "dedupe"],
      example: "  Indigo ink\nCopper plate  \n\nIndigo ink\n Cotton paper\nCopper plate" },
    { id: "slugs", name: "Make link names", symbol: "#", description: "Turn a heading like Summer Reading into summer-reading. Use one heading per line.", steps: ["kebab", "blanks"],
      example: "Notes from the Print Room\nCafé & Type\nHTTPResponse Codes\n\nहिन्दी पाठ" },
    { id: "find", name: "Find and replace", symbol: "Aa", description: "Find some text and replace every exact match.", steps: [{ id: "replace", find: "", replacement: "" }],
      example: "The draft is ready. Read the draft before Friday.", exampleSteps: [{ id: "replace", find: "draft", replacement: "report" }] },
  ];
  const byId = new Map(tools.map(operation => [operation.id, operation]));

  function stepId(step) {
    return typeof step === "string" ? step : step?.id;
  }

  function validStep(step) {
    if (typeof step === "string") return byId.has(step) && step !== "replace";
    return step?.id === "replace" && typeof step.find === "string" && typeof step.replacement === "string"
      && step.find.length <= maxFieldLength && step.replacement.length <= maxFieldLength;
  }

  function runRecipe(source, steps, counts) {
    if (source.length > maxSourceLength) throw new Error("This text is too long for one edit. Try a smaller section. The limit is 100,000 ordinary letters, or fewer for some symbols.");
    if (steps.length > maxSteps) throw new Error("Use up to 16 steps at a time.");
    let proof = source.replace(/\r\n?/gu, "\n");
    for (const [index, step] of steps.entries()) {
      const id = stepId(step);
      if (!validStep(step)) throw new Error("These tools contain an unknown step or invalid settings.");
      const operation = byId.get(id);
      if (counts && id === "replace") counts[index] = step.find ? 0 : null;
      if (!proof) continue;
      try {
        proof = id === "replace"
          ? operation.run(proof, step, counts && (count => { counts[index] = count; }))
          : operation.run(proof);
        if (proof.length > maxResultLength) throw new Error("The result is too long. Try a smaller section of text.");
      } catch (error) {
        throw new Error("Step " + (index + 1) + " · " + operation.name + ". " + error.message);
      }
    }
    return proof;
  }

  // Bound the LCS table so an unusually long paste cannot exhaust browser memory.
  function differences(before, after) {
    if (before === after) return { identical: true, parts: [] };
    if (before.length + after.length > 32_000) return { large: true, parts: [] };
    const tokenize = text => text.match(/[\p{L}\p{M}\p{N}]+|[\t \p{Zs}]+|\n|[^\p{L}\p{M}\p{N}\s]+|\s/gu) || [];
    const a = tokenize(before), b = tokenize(after);
    const columns = b.length + 1;
    if ((a.length + 1) * columns > 250_000) return { large: true, parts: [] };
    const lengths = new Uint16Array((a.length + 1) * columns);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        const cell = i * columns + j;
        lengths[cell] = a[i] === b[j] ? lengths[cell + columns + 1] + 1 : Math.max(lengths[cell + columns], lengths[cell + 1]);
      }
    }
    const parts = [];
    function append(kind, value) {
      const last = parts[parts.length - 1];
      if (last?.kind === kind) last.value += value;
      else parts.push({ kind, value });
    }
    let i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        append("same", a[i]); i++; j++;
      } else if (i < a.length && (j === b.length || lengths[(i + 1) * columns + j] >= lengths[i * columns + j + 1])) {
        append("removed", a[i++]);
      } else {
        append("added", b[j++]);
      }
    }
    return { parts };
  }

  function repeatedLinkLines(text) {
    const firstLines = new Map();
    for (const [i, line] of text.split("\n").entries()) {
      if (!line) continue;
      if (firstLines.has(line)) return [firstLines.get(line), i + 1];
      firstLines.set(line, i + 1);
    }
    return null;
  }

  function evaluate(source, steps, compare, countOriginal = false) {
    const counts = {};
    const proof = runRecipe(source, steps, counts);
    const linkOutput = steps.filter(step => step !== "blanks").at(-1) === "kebab";
    return { proof, stats: metrics(countOriginal ? source : proof), counts, repeatedLink: linkOutput ? repeatedLinkLines(proof) : null,
      changes: compare ? differences(source, proof) : null };
  }

  function evaluateJob(job) {
    try {
      return { version: job.version, result: evaluate(job.source, job.steps, job.compare, job.countOriginal) };
    } catch (error) {
      const stats = job.countOriginal && job.source.length <= maxSourceLength ? metrics(job.source) : null;
      return { version: job.version, error: error.message, stats };
    }
  }

  const api = { tools, byId, recipes, maxSteps, maxSourceLength, maxFieldLength, stepId, validStep, runRecipe, metrics, differences, evaluate, evaluateJob };
  if (typeof module === "object" && module.exports) module.exports = api;
  else globalThis.ProofTools = api;
})();
