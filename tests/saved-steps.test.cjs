const test = require("node:test");
const assert = require("node:assert/strict");
const { makeStore, toFile, fromFile } = require("../saved-steps.js");

function memoryStorage() {
  const entries = new Map();
  return {
    get length() { return entries.size; },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
}
const oldKey = "utextility.v2.recipes";
const record = (id, name, steps = ["trim"]) => ({ id: "user-" + id, name, steps });

test("earlier saved steps stay readable and migrate on first write", () => {
  const storage = memoryStorage(), store = makeStore(() => storage);
  const a = record("1", "Spacing"), b = record("2", "Headings", ["kebab"]);
  storage.setItem(oldKey, JSON.stringify([a, { id: "broken" }]));
  assert.deepEqual(store.list(), [a]);
  assert.equal(storage.length, 1);
  store.save(b);
  assert.equal(storage.getItem(oldKey), null);
  assert.deepEqual(store.list(), [b, a]);
});
test("an interrupted migration preserves original data and resumes", () => {
  const storage = memoryStorage(), store = makeStore(() => storage);
  const old = [record("1", "One"), record("2", "Two")], added = record("3", "Three");
  storage.setItem(oldKey, JSON.stringify(old));
  const write = storage.setItem; let count = 0;
  storage.setItem = (key, value) => { if (++count === 2) throw new Error("storage full"); write(key, value); };
  assert.throws(() => store.save(added), /full/);
  assert.deepEqual(store.list(), old);
  storage.setItem = write; store.save(added);
  assert.equal(store.list().length, 3);
  assert.equal(storage.getItem(oldKey), null);
});
test("independent records survive writes from different tabs and stale deletions", () => {
  const storage = memoryStorage(), first = makeStore(() => storage), second = makeStore(() => storage);
  const a = record("1", "Folio"), b = record("2", "Index"), replacement = record("3", "Folio", ["upper"]);
  first.save(a); second.save(b);
  assert.deepEqual(first.list(), [a,b]);
  assert.throws(() => first.save(record("4", "FOLIO")), /already in use/);
  second.remove(a); second.save(replacement);
  assert.throws(() => first.remove(a), /already changed/);
  assert.deepEqual(first.list(), [replacement,b]);
});
test("configured replacements survive reload and corrupt records do not hide valid ones", () => {
  const storage = memoryStorage(), store = makeStore(() => storage);
  const a = record("1", "Release", [{ id: "replace", find: "draft", replacement: "release" }]);
  store.save(a);
  storage.setItem("utextility.v2.steps.invalid", "broken data");
  assert.deepEqual(makeStore(() => storage).list(), [a]);
  assert.throws(() => store.save(record("5", "Invalid", [{}])), /valid step/);
});

test("portable steps strip unrelated data and retain versioned settings", () => {
  const steps = [{ id: "replace", find: "draft", replacement: "release" }, "trim"];
  const saved = { ...record("5", "Publish", steps), pastedText: "unrelated" };
  const file = toFile(saved);
  assert.equal(JSON.parse(file).version, 1);
  assert.doesNotMatch(file, /unrelated|user-5/);
  assert.deepEqual(fromFile(file), { name: "Publish", steps });
});
test("a damaged entry can be restored from the old format or saved again by name", () => {
  const storage = memoryStorage(), store = makeStore(() => storage);
  const old = record("one", "Headings"), fresh = record("two", "Spacing");
  storage.setItem(oldKey, JSON.stringify([old]));
  storage.setItem("utextility.v2.steps.headings", "invalid");
  storage.setItem("utextility.v2.steps.spacing", "{}");
  store.save(fresh);
  assert.deepEqual(store.list(), [old, fresh]);
  assert.equal(storage.getItem(oldKey), null);
});
test("unsupported versions, invalid fields and unknown operations are rejected on import", () => {
  const base = { app: "utextility", version: 1, name: "List", steps: ["trim"] };
  for (const bad of ["bad JSON", JSON.stringify({ ...base, version: 2 }), JSON.stringify({ ...base, steps: ["missing"] }),
    JSON.stringify({ ...base, name: " " }), JSON.stringify({ ...base, steps: Array(17).fill("upper") })]) {
    assert.throws(() => fromFile(bad), /Choose a steps file/);
  }
});
