(() => {
  "use strict";
  const engine = globalThis.ProofTools;
  const $ = id => document.getElementById(id);
  const source = $("source");
  const dialog = $("recipe-dialog");
  const numberFormat = new Intl.NumberFormat();
  const savedStore = globalThis.SavedSteps.makeStore(() => localStorage);
  const themeKey = "utextility.v2.appearance";
  const builtins = engine.recipes;
  let steps = [...builtins[0].steps];
  let activeId = builtins[0].id;
  let demo = false;
  let lastFind = builtins.find(tool => tool.id === "find").steps[0];
  let sourceName = "";
  let previousSource = null;
  let sourceVersion = 0;
  let fileRequest = 0;
  let view = "text";
  let version = 0;
  let current = null;
  let displayedStats = null;
  let limit = null;
  let renderTimer;
  let worker, running = false, queued = null, workerFailed = false;
  let dialogPage = "", returnPage = "tools", lastDeleted = null;
  let pendingImport = null, importRequest = 0;
  let saved = readRecipes();

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function button(label, className, onClick, accessibleLabel) {
    const control = element("button", label, className);
    control.type = "button";
    if (accessibleLabel) control.setAttribute("aria-label", accessibleLabel);
    control.addEventListener("click", onClick);
    return control;
  }

  function readRecipes() {
    try { return savedStore.list(); } catch { return []; }
  }

  async function updateSaved(action) {
    function write() {
      // Return storage failures so browsers release the lock normally.
      try { action(); } catch (error) { return error; }
    }
    try {
      const error = navigator.locks ? await navigator.locks.request("utextility.saved-steps", write) : write();
      if (error) throw error;
      saved = savedStore.list();
      return true;
    } catch (error) {
      $("dialog-notice").textContent = error instanceof DOMException
        ? "This browser couldn’t save that change. You can still use the steps in this tab." : error.message;
      return false;
    }
  }

  function findRecipe() {
    return [...builtins, ...saved].find(recipe => recipe.id === activeId);
  }

  function announce(message) {
    $("notice").textContent = message;
  }

  function sameSteps(a, b) {
    return a.length === b.length && a.every((step, index) => {
      const other = b[index];
      if (typeof step === "string") return step === other;
      return step.id === other?.id && step.find === other.find && step.replacement === other.replacement;
    });
  }

  function nameOf(step) {
    return engine.byId.get(engine.stepId(step)).name;
  }

  function describeSavedStep(step) {
    if (engine.stepId(step) !== "replace" || !step.find) return nameOf(step);
    return step.replacement ? "Replace “" + step.find + "” with “" + step.replacement + "”" : "Remove “" + step.find + "”";
  }

  function quickToolId(sequence) {
    if (sequence.length === 1 && engine.stepId(sequence[0]) === "replace") return "find";
    if (sameSteps(sequence, ["trim", "blanks", "dedupe-fold"])) return "list";
    return builtins.find(tool => sameSteps(sequence, tool.steps))?.id;
  }

  function renderOptions() {
    const controls = $("tool-options");
    controls.replaceChildren();
    if (quickToolId(steps) === "slugs") {
      controls.append(element("p", "“Summer Reading” becomes “summer-reading”. Enter one heading per line.", "option-hint"));
    }
    if (quickToolId(steps) === "list") {
      const label = element("label", undefined, "checkbox-label");
      const check = element("input");
      check.type = "checkbox";
      check.checked = steps.includes("dedupe-fold");
      check.addEventListener("change", () => {
        const next = steps.map(id => ["dedupe", "dedupe-fold"].includes(id) ? (check.checked ? "dedupe-fold" : "dedupe") : id);
        changeSteps(next, "", false);
      });
      label.append(check, document.createTextNode("Treat “Ink” and “ink” as the same item"));
      controls.append(label);
    }
    steps.forEach((step, index) => {
      if (engine.stepId(step) !== "replace") return;
      const group = element("fieldset", undefined, "replace-fields");
      const legend = element("legend", steps.length === 1 ? "Find and replace" : "Find and replace · Step " + (index + 1));
      if (steps.length === 1) legend.className = "sr-only";
      group.append(legend);
      for (const [key, title, hint] of [["find", "Find", "Word or phrase"], ["replacement", "Replace with", "Leave empty to remove"]]) {
        const label = element("label", title);
        const field = element("textarea", undefined, "text-field");
        field.rows = 1; field.maxLength = engine.maxFieldLength; field.spellcheck = false;
        field.value = step[key]; field.placeholder = hint; field.autocomplete = "off";
        field.addEventListener("input", () => {
          const updated = { ...steps[index], [key]: field.value };
          steps = steps.map((item, i) => i === index ? updated : item);
          lastFind = updated;
          if (activeId.startsWith("user-")) {
            activeId = quickToolId(steps) || "";
            renderRecipes(false);
          }
          announce(""); queueProof(45);
        });
        label.append(field); group.append(label);
      }
      const matches = element("span", "", "match-count");
      matches.dataset.matches = String(index);
      matches.setAttribute("role", "status");
      group.append(matches); controls.append(group);
    });
    controls.hidden = !controls.childElementCount;
  }

  function renderRecipes(rebuildOptions = true) {
    const picker = $("quick-recipes");
    picker.replaceChildren();
    const selected = findRecipe();
    for (const recipe of builtins) {
      const control = button("", "recipe-button", () => choose(recipe));
      const mark = element("span", recipe.symbol, "recipe-symbol");
      mark.setAttribute("aria-hidden", "true");
      control.append(mark, document.createTextNode(recipe.name));
      control.setAttribute("aria-pressed", String(activeId === recipe.id));
      picker.append(control);
    }
    if (!builtins.some(recipe => recipe.id === activeId)) {
      const name = selected?.name || (steps.length === 1 ? nameOf(steps[0]) : "Custom steps");
      const control = button(name, "recipe-button custom", () => showPage("tools"));
      control.title = name;
      control.setAttribute("aria-pressed", "true");
      picker.append(control);
    }
    const summary = $("step-summary");
    summary.replaceChildren();
    steps.forEach((id, index) => {
      const item = element("li");
      const order = element("span", String(index + 1), "step-order");
      order.setAttribute("aria-hidden", "true");
      item.append(order, document.createTextNode(nameOf(id)));
      summary.append(item);
    });
    if (!steps.length) summary.append(element("li", "No steps selected. The result matches your text."));
    $("step-count").textContent = "(" + steps.length + ")";
    if (rebuildOptions) renderOptions();
  }

  function choose(recipe) {
    const replaceExample = demo && recipe.example && activeId !== recipe.id;
    activeId = recipe.id;
    steps = recipe.id === "find" ? (replaceExample ? [...recipe.exampleSteps] : [lastFind]) : [...recipe.steps];
    if (recipe.id === "find") lastFind = steps[0];
    if (replaceExample) setSource(recipe.example, true, "", false);
    renderRecipes();
    announce("");
    queueProof();
    if (dialog.open) dialog.close();
    else [...$("quick-recipes").children].find(control => control.getAttribute("aria-pressed") === "true")?.focus({ preventScroll: true });
  }

  function changeSteps(next, message, rebuildOptions = true) {
    if (next.length > engine.maxSteps) {
      $("dialog-notice").textContent = "You can use up to 16 steps. Remove one to add another.";
      return;
    }
    steps = next;
    activeId = quickToolId(steps) || saved.find(recipe => sameSteps(steps, recipe.steps))?.id || "";
    renderRecipes(rebuildOptions);
    renderStepEditor();
    $("dialog-notice").textContent = message;
    announce("");
    queueProof();
  }

  const undo = button("Undo", "quiet", () => {
    if (!previousSource) return;
    const prior = previousSource;
    previousSource = null;
    setSource(prior.value, prior.demo, prior.name, false);
    announce("Your previous text is back.");
    source.focus();
  });
  $("clear").after(undo);

  function sourceInfo() {
    $("source-info").textContent = demo ? "Example text" : sourceName;
    $("clear").disabled = !source.value;
    undo.hidden = !previousSource;
  }

  function setSource(value, isDemo, name, remember = true) {
    if (remember && value !== source.value) previousSource = { value: source.value, demo, name: sourceName };
    source.value = value;
    demo = isDemo;
    sourceName = name;
    sourceVersion++;
    sourceInfo();
    queueProof();
  }

  function renderChanges(changes) {
    const panel = $("changes");
    panel.classList.remove("empty-text");
    panel.replaceChildren();
    if (!changes) return;
    if (changes.identical || changes.large) {
      panel.classList.add("empty-text");
      panel.textContent = changes.identical ? "Your text is already the same as the result." : "This edit is too long to highlight word by word. Choose Text to read the full result.";
      return;
    }
    const nodes = document.createDocumentFragment();
    for (const part of changes.parts) {
      if (part.kind === "same") nodes.append(document.createTextNode(part.value));
      else {
        const visible = part.value.replace(/ /gu, "·").replace(/\t/gu, "⇥").replace(/\u00a0/gu, "⍽").replace(/\n/gu, "↵\n");
        const mark = element(part.kind === "added" ? "ins" : "del");
        mark.title = part.kind === "added" ? "Added" : "Removed";
        mark.append(element("span", mark.title + " ", "sr-only"), document.createTextNode(visible));
        nodes.append(mark);
      }
    }
    panel.append(nodes);
  }

  function paint(message) {
    if (message.version !== version) return;
    current = message.result || null;
    displayedStats = current?.stats || message.stats || null;
    const error = message.error || "";
    const proof = current?.proof || "";
    const empty = !proof;
    $("proof").textContent = error || proof || (source.value ? "These steps removed all the text." : "Your result will appear here.");
    $("proof").classList.toggle("empty-text", empty);
    const state = $("proof-state");
    if (view === "changes" && current?.changes?.parts.length) {
      state.replaceChildren(element("span", "Removed", "legend-removed"), document.createTextNode(" · "), element("span", "Added", "legend-added"));
    } else {
      state.textContent = error ? "Check the steps" : !source.value ? "" : source.value === proof ? "No changes" : "Edited";
    }
    if (error || !source.value) {
      $("changes").textContent = error || "Paste some text to see what changes.";
      $("changes").classList.add("empty-text");
    } else renderChanges(current.changes);
    $("copy").disabled = empty;
    $("download").disabled = empty;
    for (const output of $("tool-options").querySelectorAll("[data-matches]")) {
      const count = current?.counts[output.dataset.matches];
      const label = count == null ? "" : count === 0 ? "No matches" : numberFormat.format(count) + (count === 1 ? " match" : " matches");
      if (label !== output.textContent) output.textContent = label;
    }
    const repeated = current?.repeatedLink;
    $("link-note").hidden = !repeated;
    const linkMessage = repeated ? "Result lines " + repeated.join(" and ") + " have the same link name. Edit a heading if each page needs its own name." : "";
    if ($("link-note").textContent !== linkMessage) $("link-note").textContent = linkMessage;
    for (const node of $("stats").querySelectorAll("[data-stat]")) {
      const key = node.dataset.stat;
      if (!displayedStats) node.textContent = "—";
      else if (key === "seconds") {
        const seconds = displayedStats.seconds;
        node.textContent = seconds < 60 ? seconds + "s" : Math.ceil(seconds / 60) + "m";
      } else node.textContent = numberFormat.format(displayedStats[key]);
    }
    $("approx").hidden = !displayedStats?.approximate;
    renderLimit();
    if (error) announce(error);
  }

  function sendQueued() {
    if (running || !queued) return;
    const job = queued;
    queued = null;
    if (job.version !== version) return;
    if (job.source.length > engine.maxSourceLength || job.source.length < 4_000 || location.protocol === "file:" || workerFailed || typeof Worker === "undefined") {
      paint(engine.evaluateJob(job));
      return;
    }
    try {
      if (!worker) {
        worker = new Worker("worker.js");
        worker.onmessage = event => { running = false; paint(event.data); sendQueued(); };
        worker.onerror = () => {
          worker.terminate(); worker = null; running = false; workerFailed = true;
          queueProof();
        };
      }
      running = true;
      worker.postMessage(job);
    } catch {
      running = false; workerFailed = true;
      paint(engine.evaluateJob(job));
    }
  }

  function queueProof(delay = 0) {
    version++;
    current = null;
    $("copy").disabled = true;
    $("download").disabled = true;
    $("proof-state").textContent = "Updating…";
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      queued = { version, source: source.value, steps: [...steps], compare: view === "changes", countOriginal: $("count-source").value === "original" };
      sendQueued();
    }, delay);
  }

  function showPage(page, focusSearch = false, imported = null) {
    importRequest++;
    pendingImport = imported;
    if (page === "save") returnPage = dialogPage || "tools";
    dialogPage = page;
    for (const name of ["book", "tools", "save"]) $(name + "-page").hidden = name !== page;
    $("dialog-title").textContent = { book: "Saved steps", tools: "More tools", save: imported ? "Import saved steps" : "Save your steps" }[page];
    $("dialog-notice").textContent = "";
    if (page === "book") renderBook();
    if (page === "tools") {
      $("tool-search").value = "";
      $("customize").open = !focusSearch;
      renderStepEditor(); renderTools();
    }
    if (page === "save") {
      const selectedSteps = imported?.steps || steps;
      $("recipe-name").value = imported?.name || "";
      $("save-hint").textContent = selectedSteps.map(describeSavedStep).join(" · ");
      $("save-fields-note").hidden = !selectedSteps.some(step => engine.stepId(step) === "replace");
    }
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (page === "save") $("recipe-name").focus();
    else if (focusSearch) $("tool-search").focus();
    else $("close-dialog").focus({ preventScroll: true });
  }

  function renderBook() {
    const savedList = $("saved-list");
    savedList.replaceChildren();
    $("save-from-book").disabled = !steps.length;
    for (const recipe of saved) {
      const row = element("div", undefined, "book-row");
      const info = element("div");
      info.append(element("strong", recipe.name), element("p", recipe.steps.map(nameOf).join(" · ")));
      const actions = element("div", undefined, "row-actions");
      actions.append(button("Use", "small-button", () => choose(recipe), "Use " + recipe.name));
      actions.append(button("Delete", "quiet", async () => {
          if (!await updateSaved(() => savedStore.remove(recipe))) return;
          lastDeleted = recipe;
          if (recipe.id === activeId) activeId = "";
          renderBook(); renderRecipes();
          $("dialog-notice").textContent = "Removed “" + recipe.name + "”.";
          $("undo-delete")?.focus();
        }, "Delete " + recipe.name));
      row.append(info, actions);
      savedList.append(row);
    }
    if (!saved.length) savedList.append(element("p", "Save the steps you use often, then choose them here next time.", "empty-list"));
    const choice = $("export-choice"), previous = choice.value;
    choice.replaceChildren();
    if (!saved.length) choice.append(new Option("No saved steps yet", ""));
    for (const record of saved) choice.append(new Option(record.name, record.id));
    if (saved.some(record => record.id === previous)) choice.value = previous;
    $("export-steps").disabled = choice.disabled = !saved.length;
    if (lastDeleted) {
      const restore = button("Undo deletion", "quiet", async () => {
        const record = lastDeleted;
        if (!record || !await updateSaved(() => savedStore.save(record))) return;
        lastDeleted = null; renderBook(); $("save-from-book").focus();
        $("dialog-notice").textContent = "Saved steps restored.";
      });
      restore.id = "undo-delete";
      savedList.append(restore);
    }
  }

  function renderStepEditor() {
    const list = $("step-editor");
    list.replaceChildren();
    $("save-from-tools").disabled = !steps.length;
    if (!steps.length) list.append(element("li", "Choose a tool below to add a step.", "empty-list"));
    steps.forEach((step, index) => {
      const operation = engine.byId.get(engine.stepId(step));
      const row = element("li");
      const name = element("span", undefined, "step-name");
      name.append(element("span", String(index + 1), "step-order"), document.createTextNode(operation.name));
      const actions = element("div", undefined, "row-actions");
      function move(offset) {
        const next = [...steps], target = index + offset;
        [next[index], next[target]] = [next[target], next[index]];
        changeSteps(next, operation.name + " is now step " + (target + 1) + ".");
        list.children[target]?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
      }
      const up = button("Up", "small-button", () => move(-1), "Move " + operation.name + " up");
      const down = button("Down", "small-button", () => move(1), "Move " + operation.name + " down");
      up.disabled = index === 0; down.disabled = index === steps.length - 1;
      actions.append(up, down, button("Remove", "small-button", () => {
        changeSteps(steps.filter((_, i) => i !== index), "Removed " + operation.name + ".");
        const nextFocus = list.children[Math.min(index, steps.length - 1)]?.querySelector("button:not(:disabled)") || $("tool-search");
        nextFocus.focus({ preventScroll: true });
      }, "Remove " + operation.name));
      row.append(name, actions); list.append(row);
    });
  }

  function renderTools() {
    const term = $("tool-search").value.trim().toLowerCase();
    const list = $("tool-list");
    list.replaceChildren();
    const customized = $("customize").open;
    const popular = new Set(["upper", "lower", "sort", "punctuation"]);
    const groups = new Map();
    const aliases = { kebab: "slug url link names", spaces: "whitespace", dedupe: "dedupe duplicate", "dedupe-fold": "duplicate ignore case", upper: "all caps", trim: "whitespace" };
    for (const operation of engine.tools) {
      if (term && ![operation.name, operation.group, operation.description, aliases[operation.id] || ""].some(value => value.toLowerCase().includes(term))) continue;
      const row = element("div", undefined, "tool-row");
      const info = element("div");
      info.append(element("strong", operation.name), element("p", operation.description));
      const actions = element("div", undefined, "row-actions");
      const step = operation.id === "replace" ? { id: "replace", find: "", replacement: "" } : operation.id;
      const action = customized ? "Add" : "Use";
      actions.append(button(action, "small-button", () => {
        if (customized) changeSteps([...steps, step], "Added " + operation.name + (operation.id === "replace" ? ". Set the words to find in the editor." : "."));
        else {
          changeSteps([step], ""); dialog.close(); announce("Using " + operation.name + ".");
          if (operation.id === "replace") $("tool-options").querySelector("textarea")?.focus();
        }
      }, action + " " + operation.name));
      row.append(info, actions);
      const key = term ? "Search results" : popular.has(operation.id) ? "Common tools" : operation.group;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const first = term ? "Search results" : "Common tools";
    if (groups.has(first)) {
      list.append(element("h4", first, "group-name"), ...groups.get(first));
      groups.delete(first);
    }
    for (const [name, rows] of groups) {
      const group = element("details", undefined, "tool-group");
      group.append(element("summary", name), ...rows); list.append(group);
    }
    if (!list.childElementCount) list.append(element("p", "No matching tools. Try a different name or task.", "empty-list"));
  }

  function renderLimit() {
    const status = $("limit-status");
    status.textContent = "";
    status.classList.remove("over");
    $("edit-limit").textContent = limit ? "Edit limit" : "Set a limit";
    $("remove-limit").hidden = !limit;
    if (!limit || !displayedStats) return;
    const remaining = limit.max - displayedStats[limit.unit];
    const unit = Math.abs(remaining) === 1 ? limit.unit.slice(0, -1) : limit.unit;
    status.textContent = remaining === 0 ? "Exactly at the " + numberFormat.format(limit.max) + "-" + limit.unit.slice(0, -1) + " limit."
      : numberFormat.format(Math.abs(remaining)) + " " + unit + (remaining < 0 ? " over the limit." : " remaining.");
    status.classList.toggle("over", remaining < 0);
  }
  function setLimitForm(open) {
    $("limit-form").hidden = !open;
    $("edit-limit").setAttribute("aria-expanded", String(open));
    if (open) {
      $("limit-value").value = limit?.max || "";
      $("limit-unit").value = limit?.unit || "words";
      $("limit-value").focus();
    } else $("edit-limit").focus();
  }
  $("edit-limit").addEventListener("click", () => setLimitForm($("limit-form").hidden));
  $("count-source").addEventListener("change", () => { announce(""); queueProof(); });
  $("limit-form").addEventListener("submit", event => {
    event.preventDefault();
    limit = { max: $("limit-value").valueAsNumber, unit: $("limit-unit").value };
    setLimitForm(false); renderLimit(); announce($("limit-status").textContent);
  });
  $("remove-limit").addEventListener("click", () => {
    limit = null; setLimitForm(false); renderLimit(); announce("Limit removed.");
  });
  source.addEventListener("paste", () => {
    if (demo && source.selectionStart === source.selectionEnd) source.select();
  });
  source.addEventListener("input", () => {
    demo = false; sourceName = ""; previousSource = null; sourceVersion++;
    sourceInfo(); announce(""); queueProof(65);
  });
  $("sample").addEventListener("click", () => {
    const tool = findRecipe();
    if (tool?.exampleSteps && !steps[0].find) {
      steps = [...tool.exampleSteps]; lastFind = steps[0]; renderRecipes();
    }
    const numeric = steps.some(step => engine.stepId(step) === "number");
    setSource(tool?.example || (numeric ? "1042" : builtins[0].example), true, "");
    announce("Example loaded. You can edit it or paste your own text.");
  });
  $("clear").addEventListener("click", () => { setSource("", false, ""); announce("Text cleared."); source.focus(); });
  $("open-file").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async () => {
    const file = $("file").files[0];
    $("file").value = "";
    if (!file) return;
    const request = ++fileRequest, initialSource = sourceVersion;
    try {
      if (file.size > engine.maxSourceLength * 4) throw new Error("This file is too large. Open a smaller text file or paste a section.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (text.includes("\0")) throw new Error("Choose a plain-text file, such as a .txt file.");
      if (text.length > engine.maxSourceLength) throw new Error("This file is too long. Open a smaller file or paste a section.");
      if (request !== fileRequest || initialSource !== sourceVersion) return;
      setSource(text, false, file.name); announce("Opened " + file.name + ".");
    } catch (error) {
      if (request === fileRequest && initialSource === sourceVersion) announce(error instanceof TypeError ? "Open a plain-text file saved as UTF-8." : error.message);
    }
  });

  for (const control of document.querySelectorAll("[data-view]")) {
    control.addEventListener("click", () => {
      view = control.dataset.view;
      for (const tab of document.querySelectorAll("[data-view]")) tab.setAttribute("aria-pressed", String(tab === control));
      $("proof").hidden = view !== "text"; $("changes").hidden = view !== "changes";
      if (current && (view === "text" || current.changes)) paint({ version, result: current });
      else queueProof();
    });
  }
  $("copy").addEventListener("click", async () => {
    if (!current?.proof) return;
    const requestedVersion = version;
    try {
      await navigator.clipboard.writeText(current.proof);
      if (requestedVersion === version) announce("Result copied.");
    } catch {
      if (requestedVersion !== version) return;
      if (view !== "text") document.querySelector('[data-view="text"]').click();
      const panel = $("proof");
      panel.focus(); window.getSelection()?.selectAllChildren(panel);
      announce("Your browser blocked copying. The result is selected. Use your usual Copy command.");
    }
  });
  function downloadFile(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = element("a"); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  $("download").addEventListener("click", () => {
    if (!current?.proof) return;
    downloadFile(current.proof, "utextility-result.txt", "text/plain;charset=utf-8");
    announce("Your text file is ready to download.");
  });
  $("export-steps").addEventListener("click", () => {
    const record = saved.find(item => item.id === $("export-choice").value);
    if (record) downloadFile(globalThis.SavedSteps.toFile(record), "utextility-steps.json", "application/json;charset=utf-8");
  });
  $("import-steps").addEventListener("click", () => $("steps-file").click());
  $("steps-file").addEventListener("change", async () => {
    const file = $("steps-file").files[0], request = ++importRequest;
    $("steps-file").value = "";
    if (!file) return;
    try {
      if (file.size > 256_000) throw new Error("This file is too large for a set of steps.");
      const record = globalThis.SavedSteps.fromFile(await file.text());
      if (dialog.open && request === importRequest) showPage("save", false, record);
    } catch (error) {
      if (dialog.open && request === importRequest) $("dialog-notice").textContent = error.message;
    }
  });
  dialog.addEventListener("close", () => { importRequest++; pendingImport = null; });

  $("open-book").addEventListener("click", () => { saved = readRecipes(); showPage("book"); });
  $("edit-top").addEventListener("click", () => showPage("tools"));
  $("open-tools").addEventListener("click", () => showPage("tools", true));
  $("close-dialog").addEventListener("click", () => dialog.close());
  $("tool-search").addEventListener("input", renderTools);
  $("customize").addEventListener("toggle", () => { if (dialogPage === "tools") renderTools(); });
  $("save-from-book").addEventListener("click", () => showPage("save"));
  $("save-from-tools").addEventListener("click", () => showPage("save"));
  $("back").addEventListener("click", () => showPage(returnPage));
  $("save-form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("recipe-name").value.trim();
    if (!name || builtins.some(record => record.name.toLowerCase() === name.toLowerCase())) {
      $("dialog-notice").textContent = name ? "That name belongs to a quick tool. Choose another name." : "Enter a name for these steps.";
      $("recipe-name").focus(); return;
    }
    const id = "user-" + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
    const importing = Boolean(pendingImport);
    const record = { id, name, steps: [...(pendingImport?.steps || steps)] };
    if (!await updateSaved(() => savedStore.save(record))) return;
    if (!importing) { activeId = id; renderRecipes(false); }
    if (dialog.open) { showPage("book"); $("dialog-notice").textContent = "Saved “" + name + "”."; }
  });
  window.addEventListener("storage", event => {
    if (globalThis.SavedSteps.ownsKey(event.key) || event.key === null) {
      saved = readRecipes();
      if (activeId.startsWith("user-") && !findRecipe()) {
        activeId = quickToolId(steps) || ""; renderRecipes(false);
      }
      if (dialog.open && dialogPage === "book") renderBook();
    }
    if (event.key === themeKey || event.key === null) syncTheme();
  });

  const preference = matchMedia("(prefers-color-scheme: dark)");
  let localTheme;
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const label = theme === "dark" ? "Use light mode" : "Use dark mode";
    $("theme").setAttribute("aria-label", label); $("theme").title = label;
  }
  function syncTheme() {
    try { localTheme = localStorage.getItem(themeKey); } catch { /* Session-only appearance. */ }
    applyTheme(["dark", "light"].includes(localTheme) ? localTheme : (preference.matches ? "dark" : "light"));
  }
  $("theme").addEventListener("click", () => {
    localTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(themeKey, localTheme); } catch { /* Session-only appearance. */ }
    applyTheme(localTheme);
  });
  preference.addEventListener("change", syncTheme);
  syncTheme(); renderRecipes();
  $("stats").title = "Lines include blank lines. Reading time assumes 200 words per minute.";
  setSource("", false, "", false);
})();
