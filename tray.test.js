const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createTrayController, timerStatus, getActiveTray } = require("./tray");
const { createTimer, TEST_TIMINGS } = require("./timer");
const fs = require("node:fs");

test("one persistent template tray exposes status and every requested action", t => {
  let count = 0, template = false, state = { phase: "work", remainingSeconds: 3600, paused: false };
  const invoked = [];
  class Tray {
    constructor() { count++; this.destroyed = false; }
    setContextMenu(menu) { this.menu = menu; }
    setToolTip(text) { this.tooltip = text; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  const electron = { Tray, nativeImage: { createFromPath: () => ({ isEmpty: () => false, setTemplateImage: value => { template = value; } }) },
    Menu: { buildFromTemplate(items) { return { items, getMenuItemById: id => items.find(item => item.id === id) }; } } };
  const actions = { snapshot: () => state, control: value => invoked.push(value), customize: () => invoked.push("customize"), settings: () => invoked.push("settings"), quit: () => invoked.push("quit") };
  const controller = createTrayController(electron, actions);
  t.after(() => controller.destroy());
  assert.equal(createTrayController(electron, actions), controller);
  assert.equal(count, 1); assert.equal(template, true);
  assert.equal(getActiveTray(), controller);
  assert.match(controller.menu.getMenuItemById("status").label, /60:00/);
  controller.menu.getMenuItemById("pause").click();
  state = { ...state, paused: true, remainingSeconds: 3590 };
  controller.update(state);
  assert.equal(controller.menu.getMenuItemById("pause").label, "Resume Timer");
  assert.match(controller.tray.tooltip, /Paused.*59:50/);
  controller.menu.getMenuItemById("pause").click();
  controller.menu.getMenuItemById("break").click();
  for (const label of ["Restart Session", "Customize Mascot…", "Settings…", "Quit Pixel Break Buddy"]) controller.menu.items.find(item => item.label === label).click();
  assert.deepEqual(invoked, ["pause", "resume", "break-now", "restart", "customize", "settings", "quit"]);
  controller.update({ phase: "break", remainingSeconds: 300, paused: false });
  assert.equal(controller.menu.getMenuItemById("break").enabled, false);
  controller.menu.getMenuItemById("show-preview").click();
  controller.update({ phase: "reminder", emotion: "happy", preview: true });
  assert.equal(controller.menu.getMenuItemById("show-preview").enabled, false);
  assert.equal(controller.menu.getMenuItemById("end-preview").enabled, true);
  assert.equal(controller.menu.getMenuItemById("pause").enabled, false);
  assert.equal(controller.menu.getMenuItemById("restart").enabled, false);
  controller.menu.getMenuItemById("end-preview").click();
  assert.deepEqual(invoked.slice(-2), ["show-preview", "end-preview"]);
  assert.equal(controller.tray.isDestroyed(), false, "tray persists while work/mascot visibility changes");
});

test("pause freezes countdowns and reminder moods; resume preserves remaining time", () => {
  let time = 0;
  const timer = createTimer(TEST_TIMINGS, () => time);
  time = 4000; timer.control("pause"); time = 100000;
  assert.equal(timer.snapshot().remainingSeconds, 16);
  timer.control("resume"); time += 16000;
  assert.equal(timer.snapshot().phase, "reminder");
  time += 3000; timer.control("pause"); time += 100000;
  assert.equal(timer.snapshot().emotion, "happy");
  timer.control("resume"); time += 2000;
  assert.equal(timer.snapshot().emotion, "annoyed");
  timer.control("break-now");
  assert.equal(timer.snapshot().remainingSeconds, 15);
  time += 2000; timer.control("pause"); time += 100000;
  assert.equal(timer.snapshot().remainingSeconds, 13);
  timer.control("restart");
  assert.equal(timer.snapshot().paused, false);
  assert.equal(timer.snapshot().phase, "work");
  assert.equal(timer.snapshot().remainingSeconds, 20);
});

test("tray icon files contain correctly sized 1x and Retina PNGs", () => {
  for (const [file, size] of [["buddyTemplate.png", 18], ["buddyTemplate@2x.png", 36]]) {
    const bytes = fs.readFileSync(require("node:path").join(__dirname, "assets/tray", file));
    assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
    assert.equal(bytes[25], 6, "RGBA transparency is retained");
  }
  assert.match(timerStatus({ phase: "reminder", emotion: "angry", remainingSeconds: 0, paused: true }), /Paused.*angry/);
});

test("temporary reminder previews moods without changing real deadlines or configuration", () => {
  let time = 0;
  const timer = createTimer(require("./timer").NORMAL_TIMINGS, () => time);
  time = 10000;
  const before = timer.snapshot();
  const config = timer.getTimings();
  const preview = timer.control("show-preview");
  assert.equal(preview.preview, true);
  assert.equal(preview.emotion, "happy");
  time += 5000;
  assert.equal(timer.snapshot().emotion, "annoyed");
  assert.equal(timer.control("show-preview").appearance, preview.appearance, "repeated requests do not restart preview");
  time += 5000;
  assert.equal(timer.snapshot().emotion, "angry");
  timer.control("restart"); timer.control("break-now"); timer.control("pause");
  const restored = timer.control("end-preview");
  assert.equal(restored.phase, "work");
  assert.equal(restored.remainingSeconds, before.remainingSeconds - 10);
  assert.equal(restored.paused, false);
  assert.deepEqual(timer.getTimings(), config);
  timer.control("pause");
  const frozen = timer.snapshot().remainingSeconds;
  timer.control("show-preview"); time += 15000;
  assert.equal(timer.act("snooze").remainingSeconds, frozen);
  assert.equal(timer.snapshot().paused, true);
});

test("preview stays stable across a real deadline; ending restores due reminder or break", () => {
  let time = 0;
  const timer = createTimer(TEST_TIMINGS, () => time);
  time = 19000;
  const preview = timer.control("show-preview");
  time = 21000;
  assert.equal(timer.snapshot().appearance, preview.appearance, "real deadline cannot restart the entrance");
  assert.equal(timer.snapshot().emotion, "happy");
  const real = timer.control("end-preview");
  assert.equal(real.phase, "reminder");
  assert.notEqual(real.appearance, preview.appearance);
  timer.act("take-break");
  time += 1000;
  timer.control("show-preview"); time += 2000;
  assert.equal(timer.act("take-break").phase, "break");
  assert.equal(timer.snapshot().remainingSeconds, 12);
});
