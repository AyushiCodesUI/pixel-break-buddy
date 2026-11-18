const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const model = require("./application-preferences");
const { createPreferenceStore } = require("./preferences");
const { createTimer, NORMAL_TIMINGS } = require("./timer");
const { createLoginIntegration } = require("./login");

test("application defaults, validation and persistence remain separate from mascot preferences", t => {
  assert.deepEqual(model.timings(model.DEFAULTS), NORMAL_TIMINGS);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-application-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const options = { filename: "application-preferences.json", normalize: model.normalize, valid: model.valid };
  const mascot = createPreferenceStore(directory);
  mascot.save({ ...mascot.get(), size: 140, personality: "sassy" });
  const store = createPreferenceStore(directory, options);
  assert.deepEqual(store.get(), model.DEFAULTS);
  const chosen = { workMinutes: 45, breakMinutes: 10, snoozeMinutes: 15, sounds: true, launchAtLogin: false, soundVolume: 37 };
  store.save(chosen);
  assert.deepEqual(createPreferenceStore(directory, options).get(), chosen);
  assert.equal(createPreferenceStore(directory).get().personality, "sassy");
  for (const invalid of [null, [], {}, { ...chosen, workMinutes: 20 }, { ...chosen, workMinutes: "30" }, { ...chosen, breakMinutes: 0 }, { ...chosen, snoozeMinutes: 7 }, { ...chosen, sounds: 1 }, { ...chosen, launchAtLogin: "true" }, { ...chosen, extra: true }, { ...chosen, soundVolume: -1 }, { ...chosen, soundVolume: 101 }, { ...chosen, soundVolume: "25" }, { ...chosen, soundVolume: 0.5 }]) {
    assert.equal(model.valid(invalid), false);
    assert.throws(() => store.save(invalid));
    assert.deepEqual(store.get(), chosen);
  }
  fs.writeFileSync(path.join(directory, "application-preferences.json"), JSON.stringify({ workMinutes: 45, breakMinutes: 10, snoozeMinutes: 15, sounds: true, launchAtLogin: false }));
  assert.equal(createPreferenceStore(directory, options).get().soundVolume, 25, "old settings get a gentle default volume");
  fs.mkdirSync(path.join(directory, "application-preferences.json.tmp"));
  assert.throws(() => store.save(model.DEFAULTS));
  assert.deepEqual(store.get(), chosen);
  fs.writeFileSync(path.join(directory, "application-preferences.json"), JSON.stringify({ workMinutes: 30, breakMinutes: -1, sounds: true }));
  assert.deepEqual(createPreferenceStore(directory, options).get(), { ...model.DEFAULTS, workMinutes: 30, sounds: true });
  fs.writeFileSync(path.join(directory, "application-preferences.json"), "corrupt");
  assert.deepEqual(createPreferenceStore(directory, options).get(), model.DEFAULTS);
});

test("changing duration settings never resets active work, break or snooze deadlines", () => {
  let time = 0;
  const timer = createTimer(NORMAL_TIMINGS, () => time);
  time = 60000;
  timer.configure(model.timings({ ...model.DEFAULTS, workMinutes: 30, breakMinutes: 10, snoozeMinutes: 15 }));
  assert.equal(timer.snapshot().remainingSeconds, 59 * 60);
  time = 3600000;
  assert.equal(timer.snapshot().phase, "reminder");
  assert.equal(timer.act("take-break").remainingSeconds, 600);
  time += 60000;
  timer.configure(model.timings({ ...model.DEFAULTS, workMinutes: 45, breakMinutes: 15, snoozeMinutes: 5 }));
  assert.equal(timer.snapshot().remainingSeconds, 540);
  time += 540000;
  assert.equal(timer.snapshot().phase, "work");
  assert.equal(timer.snapshot().remainingSeconds, 2700);
  time += 2700000;
  assert.equal(timer.act("snooze").remainingSeconds, 300);
  time += 60000;
  timer.configure(model.timings({ ...model.DEFAULTS, snoozeMinutes: 15 }));
  assert.equal(timer.snapshot().remainingSeconds, 240);
  assert.throws(() => timer.configure({ ...NORMAL_TIMINGS, work: 0 }));
  assert.equal(timer.snapshot().remainingSeconds, 240);
});

test("Launch at Login is unavailable in development and works through the packaged macOS API", () => {
  let enabled = false;
  let writes = 0;
  const app = { isPackaged: false, getLoginItemSettings: () => ({ openAtLogin: enabled }), setLoginItemSettings: value => { enabled = value.openAtLogin; writes++; } };
  const login = createLoginIntegration(app, "darwin");
  assert.equal(login.read().available, false);
  assert.match(login.read().message, /packaged/);
  assert.throws(() => login.set(true), /packaged/);
  login.set(false);
  assert.equal(writes, 0);
  app.isPackaged = true;
  assert.equal(login.set(true).enabled, true);
  login.set(true);
  assert.equal(writes, 1);
  assert.equal(login.set(false).enabled, false);
  assert.equal(writes, 2);
  app.setLoginItemSettings = () => {};
  assert.throws(() => login.set(true), /did not apply/);
  app.getLoginItemSettings = () => ({ openAtLogin: false, status: "requires-approval" });
  assert.equal(login.set(true).status, "requires-approval");
  app.getLoginItemSettings = () => { throw Error("OS unavailable"); };
  assert.equal(login.read().available, false);
});
