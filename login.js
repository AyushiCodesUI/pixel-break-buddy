function createLoginIntegration(app, platform) {
  function read() {
    if (platform !== "darwin" || !app.isPackaged) return {
      available: false, enabled: false, status: "unavailable",
      message: platform === "darwin" ? "Available in the packaged macOS app. Disabled while running with npm." : "Launch at Login is available on macOS.",
    };
    try {
      const value = app.getLoginItemSettings();
      return { available: true, enabled: Boolean(value.openAtLogin), status: value.status || "unknown",
        message: value.status === "requires-approval"
          ? "Approve Pixel Break Buddy in macOS System Settings → General → Login Items."
          : "Uses this installed app. macOS Login Items controls whether it can open at login." };
    } catch {
      return { available: false, enabled: false, status: "error", message: "macOS login settings could not be read. Reopen Settings to retry." };
    }
  }
  function set(enabled) {
    const before = read();
    if (!before.available) {
      if (enabled) throw Object.assign(new Error(before.message), { code: "LOGIN_UNAVAILABLE" });
      return before;
    }
    if (enabled && before.status === "requires-approval") return before;
    if (before.enabled === enabled && !(before.status === "requires-approval" && !enabled)) return before;
    app.setLoginItemSettings({ openAtLogin: enabled });
    const after = read();
    if (!after.available || (after.enabled !== enabled && !(enabled && after.status === "requires-approval"))) {
      throw Object.assign(new Error("macOS did not apply Launch at Login. Check System Settings → General → Login Items and try again."), { code: "LOGIN_FAILED" });
    }
    return after;
  }
  return { read, set };
}
module.exports = { createLoginIntegration };
