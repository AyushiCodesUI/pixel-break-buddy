const fs = require("node:fs");
const path = require("node:path");

function prepareUserData(app) {
  // productName changes Electron's default preference folder. Keep the
  // existing development preferences, while honoring explicit test overrides.
  const current = app.getPath("userData");
  if (current === path.join(app.getPath("appData"), "Pixel Break Buddy")) {
    const compatible = path.join(app.getPath("appData"), "pixel-break-buddy");
    fs.mkdirSync(compatible, { recursive: true });
    app.setPath("userData", compatible);
  }
  return app.getPath("userData");
}

function startSingleInstance(app, start, focusExisting) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on("second-instance", focusExisting);
  app.whenReady().then(start);
  return true;
}
module.exports = { prepareUserData, startSingleInstance };
