(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = globalThis.ProofTools;
  const preset = id => engine.recipes.find(recipe => recipe.id === id).steps;
  const lessons = [
    {
      id: "clean", name: "Clean a paragraph", action: "Clean up the sample",
      intro: "A line wrapped in the middle of a sentence. Join it and tidy the spacing.",
      text: "  The   bookshop opens\nat noon.\n\nBring   your favourite book.",
      fields: [{ key: "keep", label: "Keep my line breaks", type: "checkbox", initial: false }],
      steps: v => v.keep ? ["trim", "spaces"] : preset("paste"),
      feedback: (r, v) => v.keep ? "Spacing is tidy. Your line breaks are preserved." : "Spacing is tidy. Wrapped prose joins and paragraphs stay apart.",
      tip: "Try keeping the line breaks when you clean up an address or a poem."
    },
    {
      id: "list", name: "Tidy a list", action: "Tidy the list",
      intro: "Two supply lists have been pasted together. Keep the first copy of each item.",
      text: "Paper\nInk\npaper\n\nInk\nCopper plate",
      fields: [{ key: "fold", label: "Treat “Paper” and “paper” as the same item", type: "checkbox", initial: false }],
      steps: v => v.fold ? ["trim", "blanks", "dedupe-fold"] : preset("list"),
      feedback: r => r.stats.lines + (r.stats.lines === 1 ? " item remains" : " items remain") + " in the original order.",
      tip: "Try treating the two spellings as one item. The list keeps the first spelling you entered."
    },
    {
      id: "links", name: "Make link names", action: "Make link names",
      intro: "Turn each heading into a name you could use at the end of a web address.",
      text: "Summer Reading\nCafé Notes\nSummer-Reading",
      steps: () => preset("slugs"),
      feedback: r => r.repeatedLink ? "Result lines " + r.repeatedLink.join(" and ") + " share a link name." : "Each nonempty heading has its own link name.",
      tip: "Edit one of the repeated headings and watch the duplicate notice change."
    },
    {
      id: "replace", name: "Replace a phrase", action: "Replace matches",
      intro: "The announcement still says “draft”. Change every exact match in one pass.",
      text: "Read the draft today. The draft goes to print on Friday.",
      fields: [{ key: "find", label: "Find", type: "text", initial: "draft" }, { key: "replacement", label: "Replace with", type: "text", initial: "final" }],
      steps: v => [{ id: "replace", find: v.find, replacement: v.replacement }],
      feedback: r => (r.counts[0] || 0) + (r.counts[0] === 1 ? " exact match." : " exact matches."),
      tip: "Leave Replace with empty to remove matches. Capital letters matter."
    },
    {
      id: "limit", name: "Check a limit", action: "Check the limit",
      intro: "A notice has to fit a word budget. Edit the notice or change its maximum.",
      text: "Join us at the bookshop for a reading on Friday.",
      fields: [{ key: "max", label: "Maximum", type: "number", initial: "8" }, { key: "unit", label: "Count", type: "select", choices: [["words","Words"],["characters","Characters"]], initial: "words" }],
      steps: () => [],
      feedback: (r, v) => {
        const left = Number(v.max) - r.stats[v.unit];
        if (!left) return "Exactly at the limit.";
        const unit = Math.abs(left) === 1 ? v.unit.slice(0, -1) : v.unit;
        return Math.abs(left) + " " + unit + (left > 0 ? " remaining." : " over the limit.");
      },
      tip: "In the editor, Text counts lets you check either your original or the result."
    },
    {
      id: "sequence", name: "Combine steps", action: "Run both steps",
      intro: "Make a list lowercase and remove repeats. Change which step runs first.",
      text: "Ink\nink\nPaper",
      fields: [{ key: "order", label: "First step", type: "select", choices: [["lower","Make lowercase"],["dedupe","Remove repeated lines"]], initial: "lower" }],
      steps: v => v.order === "lower" ? ["lower", "dedupe"] : ["dedupe", "lower"],
      feedback: (r, v) => v.order === "lower" ? "Lowercase first, then remove repeated lines." : "Remove repeated lines first, then make the result lowercase.",
      tip: "In the editor, open Edit steps to add or reorder tools. Save the sequence to use it again."
    }
  ];

  const examples = {
    trim: "   Copper plate   \n  Cotton paper ", spaces: "Set   the   type.", unwrap: "A book\nworth keeping.\n\nA new page.",
    join: "Page one\n\nPage two", separators: "paper-and_ink", punctuation: "Ready, set… print!",
    quotes: "“It’s ready.”", replace: "A draft for the draft shelf.", blanks: "Paper\n\nInk", dedupe: "Ink\nPaper\nInk",
    "dedupe-fold": "Ink\nink\nPaper", sort: "Page 10\nPage 2\nPage 1", number: "1042",
    upper: "small print", lower: "FINE PRINT", capital: "small PRINT", title: "the art of PRINTING",
    invert: "Hello", alternate: "letterpress", reverse: "Paper", "reverse-words": "red ink"
  };
  const trials = new Map(), tried = new Set();
  const sectionHeadings = new Map([["practice", "practice-title"], ["tools", "index-title"], ["help", "help-title"]]);
  let activeLesson, initialized = false;
  let pageName, lastURL, returnControl, editorScroll = 0;
  const editorTitle = document.title;
  const fileMode = location.protocol === "file:";
  const base = new URL(location.pathname.endsWith("/guide/") ? "../" : "./", location.href);

  function href(page, section = "") {
    if (fileMode) return page === "guide" ? "#guide" + (section ? "-" + section : "") : "#desk";
    return new URL(page === "guide" ? "guide" + (section ? "#" + section : "") : "./", base).href;
  }

  function setLink(link, page, section = "") {
    link.dataset.pageLink = page;
    link.dataset.section = section;
    link.href = href(page, section);
  }

  function freshTrial(lesson) {
    const values = Object.fromEntries((lesson.fields || []).map(field => [field.key, field.initial]));
    return { text: lesson.text, values, ran: false };
  }

  function showProgress() {
    $("tried-count").textContent = tried.size + " of " + lessons.length + " tried";
    $("tried-meter").max = lessons.length;
    $("tried-meter").value = tried.size;
    for (const [index, link] of Array.from($("lesson-list").children).entries()) {
      const done = tried.has(link.dataset.section);
      link.classList.toggle("tried", done);
      link.querySelector(".lesson-check").textContent = done ? "✓" : "";
      link.querySelector(".lesson-tried").textContent = done ? " (tried)" : "";
      $("lesson-choice").options[index].text = (index + 1) + ". " + lessons[index].name + (done ? " (tried)" : "");
    }
  }

  function updateTrial(announce = false) {
    const trial = trials.get(activeLesson.id);
    const result = $("practice-result"), note = $("practice-feedback");
    result.classList.toggle("waiting", !trial.ran);
    result.classList.toggle("practice-result-ready", trial.ran);
    if (!trial.ran) {
      result.textContent = "Run the example, then edit the practice text to see changes as you type.";
      note.textContent = "";
      return;
    }
    if (!trial.text) {
      result.textContent = "Type some practice text to see a result.";
      note.textContent = "";
      return;
    }
    if (activeLesson.id === "replace" && !trial.values.find) {
      result.textContent = trial.text;
      note.textContent = "Enter a word or phrase in Find.";
      return;
    }
    if (activeLesson.id === "limit" && !$("practice-max").validity.valid) {
      result.textContent = trial.text;
      note.textContent = "Enter a whole-number maximum from 1 to 1,000,000.";
      return;
    }
    try {
      const output = engine.evaluate(trial.text, activeLesson.steps(trial.values), false);
      result.textContent = output.proof || "These steps removed all the text.";
      note.textContent = activeLesson.feedback(output, trial.values);
      if (announce) {
        tried.add(activeLesson.id);
        showProgress();
        $("practice-announcement").textContent = "Result ready. " + note.textContent;
      }
    } catch (error) {
      result.textContent = error.message;
      note.textContent = "";
      if (announce) $("practice-announcement").textContent = error.message;
    }
  }

  function showFields(lesson, trial) {
    const container = $("exercise-options");
    container.replaceChildren();
    for (const field of lesson.fields || []) {
      const label = document.createElement("label");
      const caption = document.createElement("span");
      caption.textContent = field.label;
      const control = document.createElement(field.type === "select" ? "select" : "input");
      if (field.type === "select") {
        for (const [value, name] of field.choices) control.add(new Option(name, value));
      } else control.type = field.type;
      control.id = "practice-" + field.key;
      label.htmlFor = control.id;
      if (field.type === "checkbox") {
        control.checked = trial.values[field.key];
        label.className = "checkbox-label"; label.append(control);
      } else {
        control.value = trial.values[field.key];
        control.className = "text-field";
        if (field.type === "number") {
          control.min = "1"; control.max = "1000000"; control.step = "1"; control.required = true;
        } else if (field.type === "text") {
          control.maxLength = 80;
          control.required = field.key === "find";
        }
      }
      label.append(caption);
      const group = document.createElement("div");
      group.append(label);
      if (field.type !== "checkbox") group.append(control);
      container.append(group);
      const choice = field.type === "select" || field.type === "checkbox";
      control.addEventListener(choice ? "change" : "input", () => {
        trial.values[field.key] = field.type === "checkbox" ? control.checked : control.value;
        if (trial.ran) updateTrial(choice);
      });
    }
    container.hidden = !container.childElementCount;
  }

  function showLesson(lesson) {
    activeLesson = lesson;
    if (!trials.has(lesson.id)) trials.set(lesson.id, freshTrial(lesson));
    const trial = trials.get(lesson.id), index = lessons.indexOf(lesson);
    for (const link of $("lesson-list").children) {
      if (link.dataset.section === lesson.id) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    }
    $("lesson-folio").textContent = "Lesson " + (index + 1) + " of " + lessons.length;
    $("lesson-choice").value = lesson.id;
    $("lesson-title").textContent = lesson.name;
    $("lesson-intro").textContent = lesson.intro;
    $("lesson-tip").textContent = lesson.tip;
    $("practice-source").value = trial.text;
    $("run-lesson").textContent = lesson.action;
    $("practice-announcement").textContent = "";
    showFields(lesson, trial);
    const next = lessons[index + 1];
    $("next-lesson").textContent = next ? "Next lesson" : "Back to editor";
    setLink($("next-lesson"), next ? "guide" : "editor", next?.id);
    updateTrial();
    showProgress();
  }

  function showTool(announce = false) {
    const tool = engine.byId.get($("index-choice").value);
    const sample = examples[tool.id] || "Book Club Notes";
    const step = tool.id === "replace" ? { id: "replace", find: "draft", replacement: "final" } : tool.id;
    const description = tool.description + (tool.id === "replace" ? " This example replaces “draft” with “final”." : "");
    $("index-description").textContent = description;
    $("index-before").textContent = sample;
    $("index-after").textContent = engine.runRecipe(sample, [step]);
    if (announce) $("index-announcement").textContent = tool.name + ". " + description;
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    for (const [index, lesson] of lessons.entries()) {
      const link = document.createElement("a");
      setLink(link, "guide", lesson.id);
      const number = document.createElement("span");
      number.className = "lesson-number"; number.textContent = String(index + 1).padStart(2, "0");
      number.setAttribute("aria-hidden", "true");
      const check = document.createElement("span"), status = document.createElement("span");
      check.className = "lesson-check"; check.setAttribute("aria-hidden", "true");
      status.className = "sr-only lesson-tried";
      link.append(number, document.createTextNode(lesson.name), check, status);
      $("lesson-list").append(link);
      $("lesson-choice").add(new Option((index + 1) + ". " + lesson.name, lesson.id));
    }
    const groups = new Map();
    for (const tool of engine.tools) {
      if (!groups.has(tool.group)) {
        const group = document.createElement("optgroup"); group.label = tool.group;
        groups.set(tool.group, group); $("index-choice").append(group);
      }
      groups.get(tool.group).append(new Option(tool.name, tool.id));
    }
    $("index-choice").value = "title"; showTool();
    $("lesson-choice").addEventListener("change", event => navigate("guide", event.target.value));
    $("index-choice").addEventListener("change", () => {
      showTool(true);
      history.replaceState(null, "", href("guide", "tool-" + $("index-choice").value));
      lastURL = location.href;
    });
    $("index-apply").addEventListener("click", () => {
      navigate("editor");
      document.dispatchEvent(new CustomEvent("utextility:use-tool", { detail: $("index-choice").value }));
    });
    $("practice-source").addEventListener("input", event => {
      const trial = trials.get(activeLesson.id);
      trial.text = event.target.value;
      if (trial.ran) updateTrial();
    });
    $("practice-form").addEventListener("submit", event => {
      event.preventDefault();
      trials.get(activeLesson.id).ran = true;
      updateTrial(true);
      if (matchMedia("(max-width:34rem)").matches) $("practice-result").focus();
    });
    $("reset-lesson").addEventListener("click", () => {
      trials.set(activeLesson.id, freshTrial(activeLesson));
      showLesson(activeLesson);
      $("practice-announcement").textContent = "Practice example reset.";
    });
    showLesson(lessons[0]);
  }

  function placeFocus(target) {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  function display(moveFocus) {
    const guide = /\/guide\/?$/.test(location.pathname) || (fileMode && /^#guide(?:-|$)/.test(location.hash));
    const section = fileMode ? location.hash.replace(/^#guide-?/, "") : location.hash.slice(1);
    const changed = pageName !== (guide ? "guide" : "editor");
    if (changed && pageName === "editor") {
      editorScroll = window.scrollY;
      const dialog = $("recipe-dialog");
      if (dialog.open) dialog.close();
    }
    pageName = guide ? "guide" : "editor"; lastURL = location.href;
    document.documentElement.dataset.page = pageName;
    $("desk").hidden = guide; $("guide-page").hidden = !guide; $("open-book").hidden = guide;
    document.title = guide ? "Quick guide · Utextility" : editorTitle;
    const skip = $("skip-link");
    skip.textContent = guide ? "Skip to quick guide" : "Skip to text editor";
    skip.href = guide ? "#guide-title" : "#source";
    $(guide ? "nav-guide" : "nav-editor").setAttribute("aria-current", "page");
    $(guide ? "nav-editor" : "nav-guide").removeAttribute("aria-current");
    if (guide) {
      initialize();
      const lesson = lessons.find(item => item.id === section);
      const tool = section.startsWith("tool-") && engine.byId.get(section.slice(5));
      if (tool) {
        $("index-choice").value = tool.id;
        showTool();
      }
      if (lesson && lesson !== activeLesson) showLesson(lesson);
      if (moveFocus) {
        const target = lesson ? "lesson-title" : tool ? "index-title" : sectionHeadings.get(section) || "guide-title";
        placeFocus($(target));
        if (target === "guide-title") window.scrollTo(0, 0);
      }
    } else if (changed && moveFocus) {
      const target = returnControl?.isConnected && !returnControl.disabled && returnControl.getClientRects().length ? returnControl : $("editor-title");
      target.focus({ preventScroll: true });
      window.scrollTo(0, editorScroll);
    }
  }

  $("desk").addEventListener("focusin", event => { returnControl = event.target; });
  for (const link of document.querySelectorAll("a[data-page-link]")) setLink(link, link.dataset.pageLink, link.dataset.section);
  function navigate(page, section = "") {
    const url = new URL(href(page, section), location.href).href;
    const alreadyEditor = page === "editor" && pageName === "editor";
    if (url !== location.href) {
      // Moving among lessons keeps a single guide entry in browser history.
      const method = pageName === "guide" && page === "guide" ? "replaceState" : "pushState";
      history[method](null, "", url);
    }
    display(true);
    if (alreadyEditor) { $("editor-title").focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }

  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[data-page-link]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    navigate(link.dataset.pageLink, link.dataset.section);
  });
  function onLocationChange() { if (location.href !== lastURL) display(true); }
  window.addEventListener("popstate", onLocationChange);
  window.addEventListener("hashchange", onLocationChange);
  display(Boolean(location.hash && (/\/guide\/?$/.test(location.pathname) || location.hash.startsWith("#guide-"))));
})();
