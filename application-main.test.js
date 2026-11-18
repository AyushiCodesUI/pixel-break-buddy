const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const appModel = require("./application-preferences");
const art = require("./mascot-art");
const timerModule = require("./timer");

function harness(testMode, packaged = false) {
  const windows = [], handlers = new Map();
  let time = 0, update, menu, beeps = 0, intervals = 0, loginEnabled = false, failSave = false;
  let application = { ...appModel.DEFAULTS }, mascot = { ...art.DEFAULTS };
  const ipcMain = new EventEmitter();
  ipcMain.handle = (channel, handler) => handlers.set(channel, handler);
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.destroyed = false; this.messages = [];
      this.webContents = new EventEmitter(); this.webContents.mainFrame = {};
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = (channel, value) => this.messages.push({ channel, value });
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return false; } isVisible() { return this.visible === true; } isAlwaysOnTop() { return true; }
    getBounds() { return this.options; }
    setAlwaysOnTop() {} setIgnoreMouseEvents() {} setVisibleOnAllWorkspaces() {} setPosition() {}
    showInactive() { this.visible = true; } hide() { this.visible = false; } show() {} focus() {} loadFile() { return Promise.resolve(); }
    close() { this.destroyed = true; this.emit("closed"); }
  }
  const electron = {
    app: { isPackaged: packaged, requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), getPath: () => "/unused", on() {}, quit() {},
      getLoginItemSettings: () => ({ openAtLogin: loginEnabled }), setLoginItemSettings: value => { loginEnabled = value.openAtLogin; } },
    BrowserWindow: Window, ipcMain, shell: { beep() { beeps++; } },
    screen: Object.assign(new EventEmitter(), { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }) }),
    Menu: { buildFromTemplate: value => value, setApplicationMenu: value => { menu = value; } },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("./main.js"), "utf8"), {
    __dirname, console: { log() {}, error() {} }, process: { argv: testMode ? ["electron", ".", "--test-mode"] : ["electron", "."], platform: "darwin", on() {} },
    setInterval(callback) { update = callback; intervals++; return 1; }, clearInterval() { intervals--; },
    require(name) {
      if (name === "electron") return electron;
      if (name === "./tray") return { createTrayController: () => ({ update() {}, destroy() {} }) };
      if (name === "./timer") return { ...timerModule, createTimer: timings => timerModule.createTimer(timings, () => time) };
      if (name === "./preferences") return { createPreferenceStore: (_directory, options) => ({
        get: () => ({ ...(options ? application : mascot) }),
        save(value) {
          if (failSave && options) throw Error("disk failed");
          if (!(options ? appModel : art).valid(value)) throw Error("invalid");
          if (options) application = { ...value }; else mascot = { ...value };
          return { ...value };
        },
      }) };
      return require(name);
    },
  });
  return { windows, handlers, ipcMain, setTime: value => { time = value; }, tick: () => update(),
    open: label => menu[0].submenu.find(item => item.label === label).click(),
    get beeps() { return beeps; }, get intervals() { return intervals; }, get loginEnabled() { return loginEnabled; },
    failSave: () => { failSave = true; } };
}
const eventFor = win => ({ sender: win.webContents, senderFrame: win.webContents.mainFrame });
for (const testMode of [false, true]) test(`${testMode ? "test" : "normal"} mode: settings persist without restarting countdowns, windows or timers`, async () => {
  const h = harness(testMode);
  await Promise.resolve();
  const mascot = h.windows[0];
  h.ipcMain.emit("buddy:ready", eventFor(mascot));
  h.open("Settings…"); h.open("Settings…");
  assert.equal(h.windows.length, 2); assert.equal(h.intervals, 1);
  const settings = h.windows[1], event = eventFor(settings);
  const get = h.handlers.get("application:get"), save = h.handlers.get("application:save");
  assert.equal(settings.options.webPreferences.contextIsolation, true);
  assert.equal(settings.options.webPreferences.nodeIntegration, false);
  assert.throws(() => get(eventFor(mascot)), /Unauthorized/);
  assert.throws(() => save({ sender: settings.webContents, senderFrame: {} }, appModel.DEFAULTS), /Unauthorized/);
  assert.equal(save(event, { ...appModel.DEFAULTS, workMinutes: 1 }).ok, false);
  assert.equal(save(event, { ...appModel.DEFAULTS, launchAtLogin: true }).ok, false);
  h.setTime(1000);
  const remaining = get(event).runtime.remainingSeconds;
  const chosen = { workMinutes: 30, breakMinutes: 10, snoozeMinutes: 15, sounds: true, launchAtLogin: false, soundVolume: 25 };
  const result = save(event, chosen);
  assert.equal(result.ok, true);
  assert.deepEqual(result.preferences, chosen);
  assert.equal(result.runtime.remainingSeconds, remaining);
  assert.equal(result.effectiveTimings.work, testMode ? 20000 : 1800000);
  assert.equal(h.intervals, 1);
  const initialWork = testMode ? 20000 : 3600000;
  h.setTime(initialWork); h.tick(); h.tick();
  assert.equal(h.beeps, 0, "the old system beep is removed");
  const plays = () => mascot.messages.filter(message => message.channel === "buddy:play-audio");
  const request = emotion => h.ipcMain.emit("buddy:emotion-sound", eventFor(mascot), { appearance: 1, emotion });
  assert.equal(plays().length, 0, "main waits for the renderer's settled expression");
  request("happy"); request("happy");
  assert.equal(plays().length, 1);
  h.ipcMain.emit("buddy:ready", eventFor(mascot)); request("happy");
  assert.equal(plays().length, 1, "rerender/focus cannot replay a settled sound");
  h.setTime(initialWork + (testMode ? 5000 : 120000)); h.tick();
  request("annoyed"); request("annoyed");
  assert.equal(plays().length, 2);
  h.setTime(initialWork + (testMode ? 10000 : 180000)); h.tick(); h.tick();
  request("angry"); request("angry");
  assert.equal(plays().length, 3);
  const preview = h.handlers.get("application:preview-sound");
  assert.throws(() => preview(eventFor(mascot), "happy", 25), /Unauthorized/);
  assert.equal(preview(event, "invalid", 25).ok, false);
  assert.equal(preview(event, "happy", 0).ok, false);
  assert.equal(preview(event, "happy", 50).ok, true);
  assert.equal(plays().at(-1).value.preview, true);
  assert.equal(plays().at(-1).value.volume, 50);
  assert.equal(h.beeps, 0);
  h.ipcMain.emit("buddy:action", eventFor(mascot), "snooze");
  const snooze = testMode ? 10000 : 900000;
  assert.equal(get(event).runtime.remainingSeconds, snooze / 1000);
  h.setTime(initialWork + (testMode ? 10000 : 180000) + snooze); h.tick();
  assert.equal(h.beeps, 0);
  h.ipcMain.emit("buddy:action", eventFor(mascot), "take-break");
  const breakRemaining = get(event).runtime.remainingSeconds;
  assert.equal(breakRemaining, testMode ? 15 : 600);
  save(event, { ...chosen, workMinutes: 45, breakMinutes: 15, sounds: false });
  assert.equal(preview(event, "happy", 25).ok, false, "master mute also blocks previews");
  assert.equal(get(event).runtime.remainingSeconds, breakRemaining);
  settings.close(); assert.equal(h.intervals, 1);
  h.open("Settings…");
  const reopened = h.windows.at(-1);
  assert.equal(get(eventFor(reopened)).preferences.workMinutes, 45);
  assert.equal(h.intervals, 1);
});

test("failed preference writes roll back packaged login changes", async () => {
  const h = harness(false, true);
  await Promise.resolve();
  h.open("Settings…");
  const event = eventFor(h.windows[1]);
  h.failSave();
  assert.equal(h.handlers.get("application:save")(event, { ...appModel.DEFAULTS, launchAtLogin: true }).ok, false);
  assert.equal(h.loginEnabled, false);
  assert.equal(h.handlers.get("application:get")(event).preferences.launchAtLogin, false);
});
