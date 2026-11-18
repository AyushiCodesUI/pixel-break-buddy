const { app, BrowserWindow, Menu, screen, ipcMain } = require("electron");
const path = require("path");
const { prepareUserData, startSingleInstance } = require("./bootstrap");
prepareUserData(app);
const { createTimer, TEST_TIMINGS } = require("./timer");
const { createPreferenceStore } = require("./preferences");
const applicationPreferences = require("./application-preferences");
const { createLoginIntegration } = require("./login");
const { CUES, createGate } = require("./emotion-audio");
const { createTrayController } = require("./tray");
const soundGate = createGate();
let playbackKind;
function stopAudio() {
  if (mascotWindow && !mascotWindow.isDestroyed()) mascotWindow.webContents.send("buddy:stop-audio");
  playbackKind = null;
}

const WINDOW_WIDTH = 300;
const WINDOW_HEIGHT = 450;
const EDGE_MARGIN = 16;
const testMode = process.argv.includes("--test-mode");
const log = (...values) => console.log("[Pixel Break Buddy]", ...values);
log("Startup", { argv: process.argv, testMode });
process.on("uncaughtExceptionMonitor", (error) => console.error("[main error]", error));
process.on("unhandledRejection", (error) => console.error("[main rejection]", error));
let mascotWindow;
let settingsWindow;
let preferenceStore;
let applicationWindow;
let applicationStore;
let loginIntegration;
let activeTimer;
let trayController;

function applicationSnapshot() {
  const login = loginIntegration.read();
  const preferences = applicationStore.get();
  // Respect changes made directly in macOS Login Items; do not re-register
  // the app on startup or while saving an unrelated preference.
  preferences.launchAtLogin = login.available
    ? login.enabled || (login.status === "requires-approval" && preferences.launchAtLogin)
    : preferences.launchAtLogin;
  return { preferences, login, testMode, effectiveTimings: activeTimer.getTimings(), runtime: activeTimer.snapshot() };
}

function openApplicationSettings() {
  if (applicationWindow && !applicationWindow.isDestroyed()) {
    if (applicationWindow.isMinimized()) applicationWindow.restore();
    applicationWindow.show(); applicationWindow.focus(); return;
  }
  applicationWindow = new BrowserWindow({
    title: "Settings — Pixel Break Buddy", width: 560, height: 800,
    minWidth: 440, minHeight: 600, backgroundColor: "#fff8e7", show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false,
      sandbox: true, preload: path.join(__dirname, "application-preload.js") },
  });
  const win = applicationWindow;
  secureWindow(win);
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { if (playbackKind === "preview") stopAudio(); applicationWindow = null; });
  win.loadFile(path.join(__dirname, "application-settings.html")).catch(error => console.error("[application settings]", error));
}

function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", event => event.preventDefault());
}

function openCustomization() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show(); settingsWindow.focus(); return;
  }
  settingsWindow = new BrowserWindow({
    title: "Customize Mascot", width: 660, height: 680,
    minWidth: 580, minHeight: 600, backgroundColor: "#fff8e7", show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false,
      sandbox: true, preload: path.join(__dirname, "settings-preload.js") },
  });
  const win = settingsWindow;
  secureWindow(win);
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { settingsWindow = null; });
  win.loadFile(path.join(__dirname, "settings.html")).catch(error => console.error("[settings load]", error));
}

function createWindow() {
  // workArea is the screen minus the menu bar and Dock, so the buddy
  // sits in the visible corner instead of sliding under the Dock.
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: x + width - WINDOW_WIDTH - EDGE_MARGIN,
    y: y + height - WINDOW_HEIGHT - EDGE_MARGIN,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mascotWindow = win;
  secureWindow(win);

  // "floating" keeps the buddy above normal windows on macOS.
  win.setAlwaysOnTop(true, "floating");
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const windowState = () => ({ visible: win.isVisible(), bounds: win.getBounds(),
    minimized: win.isMinimized(), alwaysOnTop: win.isAlwaysOnTop(), transparent: true });
  log("Window created", windowState());
  win.webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
    log(`Renderer console (${level}) ${sourceId}:${lineNumber}`, message);
  });
  win.webContents.on("preload-error", (_event, file, error) => console.error("[preload error]", file, error));
  win.webContents.on("did-fail-load", (_event, code, description) => console.error("[load error]", code, description));
  win.webContents.on("render-process-gone", (_event, details) => console.error("[renderer exited]", details));
  win.webContents.on("did-finish-load", () => log("Page loaded"));
  win.on("show", () => log("Window shown", windowState()));
  win.on("hide", () => { stopAudio(); log("Window hidden", windowState()); });

  const timer = createTimer(testMode ? TEST_TIMINGS : applicationPreferences.timings(applicationStore.get()));
  activeTimer = timer;
  log("Work timer started", { seconds: timer.getTimings().work / 1000 });
  let ready = false;
  let visible = false;
  let lastState = "";
  let entranceInset = EDGE_MARGIN;
  let lastRuntime = "";
  function positionOnPrimaryDisplay() {
    if (win.isDestroyed()) return;
    const display = screen.getPrimaryDisplay();
    const area = display.workArea;
    const bounds = display.bounds || area;
    const x = area.x + Math.max(0, area.width - WINDOW_WIDTH - EDGE_MARGIN);
    const y = area.y + Math.max(0, area.height - WINDOW_HEIGHT - EDGE_MARGIN);
    entranceInset = Math.max(0, bounds.x + bounds.width - (x + WINDOW_WIDTH));
    win.setPosition(x, y);
  }
  // Keep an already-visible buddy on screen after disconnecting a monitor,
  // changing the primary display, resolution, scale factor, or Dock position.
  function onDisplayChanged() { positionOnPrimaryDisplay(); update(); }
  for (const event of ["display-added", "display-removed", "display-metrics-changed"]) {
    screen.on(event, onDisplayChanged);
  }
  function update() {
    if (win.isDestroyed()) return;
    const state = timer.snapshot();
    trayController?.update(state);
    const runtimeKey = `${state.phase}:${state.remainingSeconds}:${state.durationSeconds}:${state.paused}:${Boolean(state.preview)}`;
    if (runtimeKey !== lastRuntime && applicationWindow && !applicationWindow.isDestroyed()) {
      applicationWindow.webContents.send("application:runtime", state);
      lastRuntime = runtimeKey;
    }
    const key = `${state.phase}:${state.emotion}`;
    if (key !== lastState) {
      stopAudio();
      log("Timer state", { ...state, rendererReady: ready });
      lastState = key;
    }
    if (!ready) return;
    const shouldShow = state.phase === "reminder" || state.phase === "break";
    if (shouldShow && !visible) {
      positionOnPrimaryDisplay();
    }
    win.webContents.send("buddy:state", { ...state, testMode, entranceInset });
    if (shouldShow && !visible) win.showInactive();
    else if (!shouldShow && visible) win.hide();
    visible = shouldShow;
  }
  trayController = createTrayController(require("electron"), {
    snapshot: () => timer.snapshot(),
    control(action) {
      stopAudio();
      timer.control(action);
      log("Tray timer action", action);
      update();
    },
    customize: openCustomization, settings: openApplicationSettings, quit: () => app.quit(),
  });
  function onReady(event) {
    if (event.sender !== win.webContents) return;
    ready = true;
    log("Renderer ready");
    win.webContents.send("buddy:preferences", preferenceStore.get());
    win.webContents.send("buddy:audio-preferences", applicationStore.get());
    update();
  }
  function onAction(event, action) {
    if (event.sender !== win.webContents) return;
    if (action !== "take-break" && action !== "snooze") return;
    stopAudio();
    timer.act(action);
    log("Button action", action);
    update();
  }
  ipcMain.on("buddy:ready", onReady);
  ipcMain.on("buddy:action", onAction);
  function onInteractive(event, interactive) {
    if (event.sender !== win.webContents || typeof interactive !== "boolean") return;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
  }
  ipcMain.on("buddy:interactive", onInteractive);
  const interval = setInterval(update, 250);
  win.loadFile(path.join(__dirname, "index.html")).catch((error) => console.error("[load error]", error));
  win.on("closed", () => {
    clearInterval(interval);
    for (const event of ["display-added", "display-removed", "display-metrics-changed"]) {
      screen.removeListener(event, onDisplayChanged);
    }
    ipcMain.removeListener("buddy:ready", onReady);
    ipcMain.removeListener("buddy:action", onAction);
    ipcMain.removeListener("buddy:interactive", onInteractive);
  });

  // A frameless window has no close button. Right-click the buddy to quit.
  win.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: "Customize Mascot…", click: openCustomization },
      { label: "Settings…", click: openApplicationSettings },
      { type: "separator" },
      { label: "Quit Pixel Break Buddy", role: "quit" },
    ]).popup({ window: win });
  });
}

startSingleInstance(app, () => {
  preferenceStore = createPreferenceStore(app.getPath("userData"));
  applicationStore = createPreferenceStore(app.getPath("userData"), {
    filename: "application-preferences.json", normalize: applicationPreferences.normalize, valid: applicationPreferences.valid,
  });
  loginIntegration = createLoginIntegration(app, process.platform);
  const isApplicationSettings = event => applicationWindow && !applicationWindow.isDestroyed()
    && event.sender === applicationWindow.webContents && event.senderFrame === event.sender.mainFrame;
  ipcMain.handle("application:get", event => {
    if (!isApplicationSettings(event)) throw new Error("Unauthorized application settings request");
    return applicationSnapshot();
  });
  ipcMain.handle("application:save", (event, value) => {
    if (!isApplicationSettings(event)) throw new Error("Unauthorized application settings request");
    if (!applicationPreferences.valid(value)) return { ok: false, error: "Choose valid durations, toggles, and a volume from 0% to 100%." };
    const previousLogin = loginIntegration.read();
    try {
      if (previousLogin.available || value.launchAtLogin !== applicationStore.get().launchAtLogin) {
        loginIntegration.set(value.launchAtLogin);
      }
      applicationStore.save(value);
      if (mascotWindow && !mascotWindow.isDestroyed()) mascotWindow.webContents.send("buddy:audio-preferences", applicationStore.get());
      if (!value.sounds || value.soundVolume === 0) stopAudio();
      if (!testMode) activeTimer.configure(applicationPreferences.timings(value));
      log("Application settings saved; active countdown preserved", { testMode, preferences: value });
      return { ok: true, ...applicationSnapshot() };
    } catch (error) {
      const currentLogin = loginIntegration.read();
      if (previousLogin.available && (currentLogin.enabled !== previousLogin.enabled || currentLogin.status !== previousLogin.status)) {
        try { loginIntegration.set(previousLogin.enabled); }
        catch (rollbackError) { console.error("[login rollback]", rollbackError); }
      }
      console.error("[application preferences]", error);
      return { ok: false, error: error.code?.startsWith("LOGIN_") ? error.message : "Could not save settings. Please try again; check macOS Login Items if you changed Launch at Login." };
    }
  });
  ipcMain.on("buddy:emotion-sound", (event, request) => {
    if (!mascotWindow || mascotWindow.isDestroyed() || event.sender !== mascotWindow.webContents
      || event.senderFrame !== event.sender.mainFrame) return;
    const state = activeTimer.snapshot();
    const preferences = applicationStore.get();
    if (!soundGate.accept(state, request, preferences, mascotWindow.isVisible() && !mascotWindow.isMinimized())) return;
    playbackKind = "reminder";
    mascotWindow.webContents.send("buddy:play-audio", { emotion: request.emotion, volume: preferences.soundVolume, preview: false });
  });
  ipcMain.handle("application:preview-sound", (event, emotion, volume) => {
    if (!isApplicationSettings(event)) throw new Error("Unauthorized sound preview request");
    if (typeof emotion !== "string" || !Object.hasOwn(CUES, emotion) || !Number.isInteger(volume) || volume < 0 || volume > 100) return { ok: false, error: "Choose a valid sound and volume." };
    if (!applicationStore.get().sounds) return { ok: false, error: "Enable Reminder Sounds and save settings before previewing." };
    if (volume === 0) return { ok: false, error: "Increase the volume to preview a sound." };
    if (!mascotWindow || mascotWindow.isDestroyed()) return { ok: false, error: "The mascot audio player is unavailable." };
    playbackKind = "preview";
    mascotWindow.webContents.send("buddy:play-audio", { emotion, volume, preview: true });
    return { ok: true };
  });
  // Only the settings main frame can read or save preferences through invoke.
  const isSettings = event => settingsWindow && !settingsWindow.isDestroyed()
    && event.sender === settingsWindow.webContents && event.senderFrame === event.sender.mainFrame;
  ipcMain.handle("settings:get", event => {
    if (!isSettings(event)) throw new Error("Unauthorized settings request");
    return preferenceStore.get();
  });
  ipcMain.handle("settings:save", (event, value) => {
    if (!isSettings(event)) throw new Error("Unauthorized settings request");
    try {
      const preferences = preferenceStore.save(value);
      if (mascotWindow && !mascotWindow.isDestroyed()) mascotWindow.webContents.send("buddy:preferences", preferences);
      return { ok: true, preferences };
    } catch (error) {
      console.error("[preferences] Save failed:", error.message);
      return { ok: false, error: "Could not save changes. Please try again." };
    }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Pixel Break Buddy", submenu: [
      { label: "Customize Mascot…", click: openCustomization },
      { label: "Settings…", accelerator: "CmdOrCtrl+,", click: openApplicationSettings },
      { type: "separator" }, { role: "quit" },
    ] },
    { role: "editMenu" }, { role: "windowMenu" },
  ]));
  createWindow();
}, () => {
  // Reopening the app is an explicit request to interact, not a new timer.
  if (applicationWindow && !applicationWindow.isDestroyed()) {
    if (applicationWindow.isMinimized()) applicationWindow.restore();
    applicationWindow.show(); applicationWindow.focus();
  } else if (activeTimer) openApplicationSettings();
});

app.on("window-all-closed", () => {
  app.quit();
});
app.on("will-quit", () => { trayController?.destroy(); });
