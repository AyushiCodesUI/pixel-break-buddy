(() => {
  const model = window.ApplicationPreferences;
  const controls = document.getElementById("controls");
  const saveButton = document.getElementById("save");
  const status = document.getElementById("status");
  const reload = document.getElementById("reload");
  let loaded = false;
  let saving = false;
  let saved;
  let login;
  const field = key => document.getElementById(key);
  function draft() {
    return {
      workMinutes: Number(field("workMinutes").value), breakMinutes: Number(field("breakMinutes").value),
      snoozeMinutes: Number(field("snoozeMinutes").value), sounds: field("sounds").checked,
      launchAtLogin: field("launchAtLogin").checked, soundVolume: Number(field("soundVolume").value),
    };
  }
  function setEnabled() {
    controls.disabled = !loaded || saving;
    field("launchAtLogin").disabled = !login?.available;
    saveButton.disabled = !loaded || saving || JSON.stringify(draft()) === JSON.stringify(saved);
    field("volume-value").textContent = `${field("soundVolume").value}%`;
    for (const emotion of ["happy", "annoyed", "angry"]) {
      field(`preview-${emotion}`).disabled = !loaded || saving || !saved?.sounds || !field("sounds").checked || Number(field("soundVolume").value) === 0;
    }
    field("preview-note").textContent = !saved?.sounds || !field("sounds").checked
      ? "Enable Reminder Sounds and save to preview."
      : Number(field("soundVolume").value) === 0 ? "Volume is 0% (muted)."
      : "Previews use the slider volume. Save to apply volume changes to reminders.";
  }
  function runtime(value) {
    if (value.preview) { field("active-timer").textContent = "Test reminder active · real timer continues · end via menu bar"; return; }
    const names = { work: "Work session", break: "Break", snooze: "Snoozed", reminder: "Break reminder" };
    const seconds = Math.max(0, value.remainingSeconds);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    field("active-timer").textContent = `${value.paused ? "Paused · " : ""}${value.phase === "reminder" ? "Break reminder is active" : `${names[value.phase]} · ${time} remaining`}`;
  }
  function display(snapshot) {
    saved = snapshot.preferences; login = snapshot.login;
    for (const key of Object.keys(model.OPTIONS)) field(key).value = saved[key];
    for (const key of ["sounds", "launchAtLogin"]) field(key).checked = saved[key];
    field("soundVolume").value = saved.soundVolume;
    field("login-note").textContent = login.message;
    field("mode").textContent = snapshot.testMode ? "TEST MODE · ACCELERATED TIMERS" : "CURRENT TIMER";
    const timings = snapshot.effectiveTimings;
    const unit = value => value < 60000 ? `${value / 1000} sec` : `${value / 60000} min`;
    field("effective-config").textContent = `Next phases: ${unit(timings.work)} work · ${unit(timings.break)} break · ${unit(timings.snooze)} snooze`;
    field("saved-config").textContent = snapshot.testMode
      ? `Saved for normal mode: ${saved.workMinutes} min work · ${saved.breakMinutes} min break · ${saved.snoozeMinutes} min snooze. Test timings stay unchanged.`
      : "Current countdowns finish using their original duration.";
    runtime(snapshot.runtime);
  }
  async function load() {
    loaded = false; reload.hidden = true;
    try {
      const snapshot = await window.applicationSettings.get();
      display(snapshot); loaded = true; status.textContent = "Preferences are stored on this Mac.";
    } catch {
      status.textContent = "Could not load settings. Please retry."; reload.hidden = false;
    }
    setEnabled();
  }
  document.getElementById("settings-form").addEventListener("input", () => {
    setEnabled();
    if (loaded) status.textContent = "Unsaved changes. Current countdowns will stay unchanged.";
  });
  document.getElementById("settings-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!loaded || saving) return;
    const value = draft();
    if (!model.valid(value)) { status.textContent = "Choose valid durations and a volume between 0% and 100%."; return; }
    saving = true; setEnabled(); status.textContent = "Saving…";
    try {
      const result = await window.applicationSettings.save(value);
      if (!result.ok) throw new Error(result.error);
      display(result); status.textContent = result.login.status === "requires-approval" ? result.login.message : "Saved. Active countdowns were not reset.";
    } catch (error) { status.textContent = error.message || "Could not save settings. Please retry."; }
    saving = false; setEnabled();
  });
  for (const emotion of ["happy", "annoyed", "angry"]) {
    field(`preview-${emotion}`).addEventListener("click", async () => {
      if (!loaded || !saved.sounds || !field("sounds").checked) return;
      try {
        const result = await window.applicationSettings.previewSound(emotion, Number(field("soundVolume").value));
        status.textContent = result.ok ? `Previewing ${emotion} sound at ${field("soundVolume").value}%.` : result.error;
      } catch { status.textContent = "Sound preview unavailable. Please try again."; }
    });
  }
  window.applicationSettings.onRuntime(runtime);
  reload.addEventListener("click", load);
  load();
})();
