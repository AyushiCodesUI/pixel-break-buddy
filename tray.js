const path = require("node:path");
let active;
function timerStatus(state) {
  if (state.preview) return `Test reminder · ${state.emotion} · real timer continues`;
  const names = { work: "Work session", break: "Break", snooze: "Snoozed", reminder: "Break reminder" };
  const seconds = state.remainingSeconds;
  const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return `${state.paused ? "Paused · " : ""}${names[state.phase]}${state.phase === "reminder" ? " · " + state.emotion : " · " + remaining + " remaining"}`;
}
function createTrayController({ Tray, Menu, nativeImage }, actions) {
  if (active && !active.tray.isDestroyed()) return active;
  const image = nativeImage.createFromPath(path.join(__dirname, "assets/tray/buddyTemplate.png"));
  if (image.isEmpty()) throw new Error("Menu-bar icon is missing");
  image.setTemplateImage(true);
  const tray = new Tray(image);
  const menu = Menu.buildFromTemplate([
    { label: "Pixel Break Buddy", enabled: false },
    { id: "status", label: "Starting…", enabled: false },
    { type: "separator" },
    { id: "pause", label: "Pause Timer", click: () => actions.control(actions.snapshot().paused ? "resume" : "pause") },
    { id: "break", label: "Take a Break Now", click: () => actions.control("break-now") },
    { id: "restart", label: "Restart Session", click: () => actions.control("restart") },
    { type: "separator" },
    { id: "show-preview", label: "Show Test Reminder Now", click: () => actions.control("show-preview") },
    { id: "end-preview", label: "End Test Reminder", enabled: false, click: () => actions.control("end-preview") },
    { type: "separator" },
    { label: "Customize Mascot…", click: actions.customize },
    { label: "Settings…", click: actions.settings },
    { type: "separator" },
    { label: "Quit Pixel Break Buddy", click: actions.quit },
  ]);
  tray.setContextMenu(menu);
  let last = "";
  active = {
    tray, menu,
    update(state) {
      const status = timerStatus(state);
      if (status === last) return;
      last = status;
      menu.getMenuItemById("status").label = status;
      menu.getMenuItemById("pause").label = state.paused ? "Resume Timer" : "Pause Timer";
      menu.getMenuItemById("pause").enabled = !state.preview;
      menu.getMenuItemById("break").enabled = !state.preview && state.phase !== "break";
      menu.getMenuItemById("restart").enabled = !state.preview;
      menu.getMenuItemById("show-preview").enabled = !state.preview;
      menu.getMenuItemById("end-preview").enabled = Boolean(state.preview);
      tray.setToolTip(`Pixel Break Buddy — ${status}`);
    },
    destroy() { if (!tray.isDestroyed()) tray.destroy(); active = null; },
  };
  active.update(actions.snapshot());
  return active;
}
module.exports = { createTrayController, timerStatus, getActiveTray: () => active };
