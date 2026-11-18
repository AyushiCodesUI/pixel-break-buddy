const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const art = require("./mascot-art");
const { createPreferenceStore } = require("./preferences");

test("preferences validate, persist across store instances, and reject invalid writes", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-preferences-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createPreferenceStore(dir);
  assert.deepEqual(store.get(), art.DEFAULTS);
  const chosen = { design: "cat", color: "mint", size: 137, accessory: "hat", personality: "sassy" };
  store.save(chosen);
  assert.deepEqual(createPreferenceStore(dir).get(), chosen);
  for (const invalid of [null, {}, { ...chosen, size: 500 }, { ...chosen, design: "dog" }, { ...chosen, size: "100" }, { ...chosen, extra: true }]) {
    assert.throws(() => store.save(invalid), /Invalid/);
    assert.deepEqual(store.get(), chosen);
    assert.deepEqual(createPreferenceStore(dir).get(), chosen);
  }
  assert.deepEqual(fs.readdirSync(dir), ["mascot-preferences.json"]);
  fs.writeFileSync(path.join(dir, "mascot-preferences.json"), "broken json");
  assert.deepEqual(createPreferenceStore(dir).get(), art.DEFAULTS);
  fs.writeFileSync(path.join(dir, "mascot-preferences.json"), JSON.stringify({ color: "pink", size: 999, design: "unknown" }));
  assert.deepEqual(createPreferenceStore(dir).get(), { ...art.DEFAULTS, color: "pink", size: 140 });
});

test("failed disk writes retain the previously saved preferences", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-save-failure-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createPreferenceStore(dir);
  store.save(art.DEFAULTS);
  fs.mkdirSync(path.join(dir, "mascot-preferences.json.tmp"));
  assert.throws(() => store.save({ ...art.DEFAULTS, color: "blue" }));
  assert.deepEqual(store.get(), art.DEFAULTS);
  assert.deepEqual(createPreferenceStore(dir).get(), art.DEFAULTS);
});

test("every design, accessory and emotion uses the same valid pixel grid", () => {
  const palette = new Set([".", "s", "y", "w", "b", "c", "m"]);
  const designs = new Set();
  for (const design of art.OPTIONS.design) {
    designs.add(art.frame({ ...art.DEFAULTS, design }).join(""));
    for (const accessory of art.OPTIONS.accessory) for (const emotion of ["happy", "annoyed", "angry"]) {
      const prefs = { ...art.DEFAULTS, design, accessory };
      const cells = art.frame(prefs, { emotion });
      assert.equal(cells.length, 196);
      assert.ok(cells.every(cell => palette.has(cell)));
      assert.notDeepEqual(cells, art.frame(prefs, { emotion, blink: true }));
      if (accessory !== "none") assert.notDeepEqual(cells, art.frame({ ...prefs, accessory: "none" }, { emotion }));
      if (accessory === "hat" || accessory === "bow") {
        const idle = art.frame(prefs, { emotion, gaze: 1 });
        const indices = accessory === "hat" ? [5, 6, 7, 8] : [8 * 14 + 4, 9 * 14 + 9];
        indices.forEach(index => assert.equal(cells[index], idle[index]));
      }
    }
  }
  assert.equal(designs.size, 3);
});

test("all colors and slider sizes draw on physical pixel boundaries without scaled transforms", () => {
  const element = { style: {} };
  const pixels = Array.from({ length: 196 }, () => ({ style: {} }));
  const colors = new Set();
  for (const color of art.OPTIONS.color) for (let size = 70; size <= 140; size++) for (const dpr of [1, 2]) {
    const width = art.draw(element, pixels, { ...art.DEFAULTS, size, color }, {}, dpr);
    assert.equal(width, Math.round(112 * size / 100 * dpr) / dpr);
    for (const pixel of pixels) for (const key of ["left", "top", "width", "height"]) {
      assert.equal(Number.parseFloat(pixel.style[key]) * dpr % 1, 0);
    }
    colors.add(pixels[2 * 14 + 5].style.background);
    assert.ok(pixels.every(pixel => pixel.style.transform === ""));
  }
  assert.equal(colors.size, 5);
});
