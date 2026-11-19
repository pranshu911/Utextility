(() => {
  "use strict";
  const legacyKey = "utextility.v2.recipes";
  const prefix = "utextility.v2.steps.";
  const engine = typeof module === "object" && module.exports ? require("./engine.js") : globalThis.ProofTools;
  const keyFor = name => prefix + name.trim().toLowerCase();

  function validDefinition(record) {
    return record && typeof record.name === "string" && record.name.trim() && record.name.length <= 60 &&
      Array.isArray(record.steps) && record.steps.length > 0 && record.steps.length <= engine.maxSteps &&
      record.steps.every(engine.validStep);
  }

  function valid(record) {
    return validDefinition(record) && typeof record.id === "string" && record.id.startsWith("user-");
  }

  function matchesKey(record, key) {
    return valid(record) && key === keyFor(record.name);
  }

  function definition(record) {
    return { name: record.name.trim(), steps: record.steps.map(step => typeof step === "string" ? step :
      { id: step.id, find: step.find, replacement: step.replacement }) };
  }

  function toFile(record) {
    if (!validDefinition(record)) throw new Error("Choose valid saved steps to download.");
    return JSON.stringify({ app: "utextility", version: 1, ...definition(record) }, null, 2) + "\n";
  }

  function fromFile(text) {
    const record = parse(text);
    if (record?.app !== "utextility" || record.version !== 1 || !validDefinition(record)) {
      throw new Error("Choose a steps file downloaded from this version of Utextility.");
    }
    return definition(record);
  }

  function parse(value) {
    try { return JSON.parse(value); } catch { return null; }
  }

  function makeStore(getStorage) {
    function list() {
      const storage = getStorage(), records = new Map();
      const old = parse(storage.getItem(legacyKey));
      if (Array.isArray(old)) {
        for (const record of old.filter(valid)) records.set(keyFor(record.name), record);
      }
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix)) continue;
        const record = parse(storage.getItem(key));
        if (matchesKey(record, key)) records.set(key, record);
      }
      return [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Remove the old array only after every valid record has its own durable key.
    // An interrupted migration can be retried, even if some records already exist.
    function migrate(storage) {
      const old = parse(storage.getItem(legacyKey));
      if (!Array.isArray(old)) return;
      for (const record of old.filter(valid)) {
        const key = keyFor(record.name);
        if (!matchesKey(parse(storage.getItem(key)), key)) storage.setItem(key, JSON.stringify(record));
      }
      storage.removeItem(legacyKey);
    }

    function save(record) {
      if (!valid(record)) throw new Error("Choose a name and at least one valid step.");
      const storage = getStorage();
      migrate(storage);
      const key = keyFor(record.name);
      if (matchesKey(parse(storage.getItem(key)), key)) throw new Error("That name is already in use. Choose another name.");
      storage.setItem(key, JSON.stringify(record));
    }

    function remove(record) {
      const storage = getStorage();
      migrate(storage);
      const key = keyFor(record.name);
      if (parse(storage.getItem(key))?.id !== record.id) throw new Error("These saved steps have already changed in another tab.");
      storage.removeItem(key);
    }
    return { list, save, remove };
  }

  const api = { makeStore, toFile, fromFile, ownsKey: key => key === legacyKey || (typeof key === "string" && key.startsWith(prefix)) };
  if (typeof module === "object" && module.exports) module.exports = api;
  else globalThis.SavedSteps = api;
})();
