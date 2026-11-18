const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { startSingleInstance, prepareUserData } = require("./bootstrap");

test("only the first instance starts; subsequent launch requests focus without a second timer", async () => {
  const app = new EventEmitter();
  let starts = 0, focus = 0, quits = 0;
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => Promise.resolve();
  app.quit = () => quits++;
  assert.equal(startSingleInstance(app, () => starts++, () => focus++), true);
  await Promise.resolve();
  app.emit("second-instance"); app.emit("second-instance");
  assert.equal(starts, 1); assert.equal(focus, 2);
  app.requestSingleInstanceLock = () => false;
  assert.equal(startSingleInstance(app, () => starts++, () => focus++), false);
  assert.equal(quits, 1); assert.equal(starts, 1);
});

test("packaged app keeps the existing preference folder and respects isolated test paths", t => {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-userdata-"));
  t.after(() => fs.rmSync(appData, { recursive: true, force: true }));
  let userData = path.join(appData, "Pixel Break Buddy");
  const app = { isPackaged: true, getPath: name => name === "appData" ? appData : userData,
    setPath: (_name, value) => { userData = value; } };
  assert.equal(prepareUserData(app), path.join(appData, "pixel-break-buddy"));
  assert.ok(fs.statSync(userData).isDirectory());
  userData = path.join(appData, "isolated-test");
  assert.equal(prepareUserData(app), userData);
  app.isPackaged = false;
  userData = path.join(appData, "Pixel Break Buddy");
  assert.equal(prepareUserData(app), path.join(appData, "pixel-break-buddy"));
});
