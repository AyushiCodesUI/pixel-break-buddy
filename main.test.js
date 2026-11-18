const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const vm = require("node:vm");
const art = require("./mascot-art");

test("settings singleton uses validated IPC and leaves the single reminder timer running", async () => {
  const windows = [];
  const handlers = new Map();
  const ipcMain = new EventEmitter();
  ipcMain.handle = (channel, callback) => handlers.set(channel, callback);
  let menu;
  let timers = 0;
  let trayActions;
  let preferences = { ...art.DEFAULTS };
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.messages = []; this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = {};
      this.webContents.setWindowOpenHandler = callback => { this.openHandler = callback; };
      this.webContents.send = (channel, value) => this.messages.push({ channel, value });
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return false; }
    isVisible() { return false; }
    isAlwaysOnTop() { return true; }
    getBounds() { return this.options; }
    setAlwaysOnTop() {} setIgnoreMouseEvents() {} setVisibleOnAllWorkspaces() {}
    setPosition(x, y) { this.position = [x, y]; } showInactive() {} hide() {} show() {} focus() {}
    loadFile() { return Promise.resolve(); }
    close() { this.destroyed = true; this.emit("closed"); }
  }
  const electron = {
    app: { requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), getPath: () => "/unused", on() {}, quit() {} },
    BrowserWindow: Window, ipcMain,
    screen: Object.assign(new EventEmitter(), { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }) }),
    Menu: { buildFromTemplate: template => template, setApplicationMenu: value => { menu = value; } },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("./main.js"), "utf8"), {
    __dirname,
    console: { log() {}, error() {} },
    process: { argv: ["electron", ".", "--test-mode"], on() {} },
    setInterval() { timers++; return 1; }, clearInterval() { timers--; },
    require(name) {
      if (name === "electron") return electron;
      if (name === "./tray") return { createTrayController: (_electron, actions) => { trayActions = actions; return { update() {}, destroy() {} }; } };
      if (name === "./preferences") return { createPreferenceStore: () => ({
        get: () => ({ ...preferences }),
        save(value) { if (!art.valid(value)) throw Error("Invalid"); preferences = art.normalize(value); return preferences; },
      }) };
      return require(name);
    },
  });
  await Promise.resolve();
  assert.equal(windows.length, 1);
  assert.equal(timers, 1);
  assert.equal(windows[0].options.webPreferences.sandbox, true);
  assert.equal(windows[0].options.webPreferences.nodeIntegration, false);
  assert.equal(windows[0].options.webPreferences.contextIsolation, true);
  electron.screen.getPrimaryDisplay = () => ({ workArea: { x: -1920, y: 24, width: 1920, height: 1056 } });
  electron.screen.emit("display-metrics-changed");
  assert.deepEqual(windows[0].position, [-316, 614]);
  assert.equal(timers, 1);
  const eventReady = { sender: windows[0].webContents };
  ipcMain.emit("buddy:ready", eventReady);
  trayActions.control("show-preview");
  assert.equal(windows.length, 1);
  assert.equal(timers, 1);
  assert.equal(windows[0].messages.filter(m => m.channel === "buddy:state").at(-1).value.preview, true);
  trayActions.control("end-preview");
  assert.equal(windows[0].messages.filter(m => m.channel === "buddy:state").at(-1).value.phase, "work");
  assert.equal(timers, 1);
  electron.screen.getPrimaryDisplay = () => ({ workArea: { x: 0, y: 24, width: 1280, height: 696 } });
  electron.screen.emit("display-removed");
  assert.deepEqual(windows[0].position, [964, 254]);
  assert.equal(timers, 1, "screen changes reuse the existing timer");
  const open = menu[0].submenu[0].click;
  open(); open();
  assert.equal(windows.length, 2, "repeated menu actions reuse settings");
  assert.equal(timers, 1);
  const settings = windows[1];
  const mascot = windows[0];
  assert.equal(settings.options.webPreferences.nodeIntegration, false);
  assert.equal(settings.options.webPreferences.contextIsolation, true);
  assert.equal(settings.openHandler().action, "deny");
  const event = { sender: settings.webContents, senderFrame: settings.webContents.mainFrame };
  const save = handlers.get("settings:save");
  const chosen = { ...art.DEFAULTS, design: "bunny", accessory: "glasses" };
  assert.throws(() => save({ sender: mascot.webContents, senderFrame: mascot.webContents.mainFrame }, chosen), /Unauthorized/);
  assert.throws(() => save({ sender: settings.webContents, senderFrame: {} }, chosen), /Unauthorized/);
  assert.equal(save(event, { ...chosen, size: 900 }).ok, false);
  assert.equal(save(event, chosen).ok, true);
  assert.deepEqual(mascot.messages.at(-1).value, chosen);
  settings.close();
  assert.equal(timers, 1, "closing settings keeps reminders running");
  open();
  assert.equal(windows.length, 3);
  assert.equal(timers, 1, "reopening settings creates no reminder timer");
  const reopened = windows[2];
  assert.deepEqual(handlers.get("settings:get")({ sender: reopened.webContents, senderFrame: reopened.webContents.mainFrame }), chosen);
  windows[0].close();
  for (const event of ["display-added", "display-removed", "display-metrics-changed"]) assert.equal(electron.screen.listenerCount(event), 0);
  assert.equal(timers, 0);
});
