(function (root) {
  const DEFAULTS = Object.freeze({ workMinutes: 60, breakMinutes: 5, snoozeMinutes: 10, sounds: false, launchAtLogin: false, soundVolume: 25 });
  const OPTIONS = Object.freeze({ workMinutes: [30, 45, 60], breakMinutes: [5, 10, 15], snoozeMinutes: [5, 10, 15] });
  function normalize(value) {
    const result = { ...DEFAULTS };
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const [key, choices] of Object.entries(OPTIONS)) if (choices.includes(value[key])) result[key] = value[key];
    for (const key of ["sounds", "launchAtLogin"]) if (typeof value[key] === "boolean") result[key] = value[key];
    if (Number.isFinite(value.soundVolume)) result.soundVolume = Math.min(100, Math.max(0, Math.round(value.soundVolume)));
    return result;
  }
  function valid(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value)
      && Object.entries(OPTIONS).every(([key, choices]) => choices.includes(value[key]))
      && ["sounds", "launchAtLogin"].every(key => typeof value[key] === "boolean")
      && Number.isInteger(value.soundVolume) && value.soundVolume >= 0 && value.soundVolume <= 100
      && Object.keys(value).every(key => Object.hasOwn(DEFAULTS, key)));
  }
  function timings(value) {
    const prefs = normalize(value);
    return { work: prefs.workMinutes * 60000, break: prefs.breakMinutes * 60000,
      snooze: prefs.snoozeMinutes * 60000, annoyed: 120000, angry: 180000 };
  }
  const api = { DEFAULTS, OPTIONS, normalize, valid, timings };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ApplicationPreferences = api;
})(globalThis);
