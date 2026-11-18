(() => {
  const art = window.MascotArt;
  const preview = document.getElementById("preview");
  const status = document.getElementById("status");
  const retry = document.getElementById("retry");
  const controls = document.getElementById("controls");
  const fields = Object.keys(art.DEFAULTS);
  const previewImage = document.getElementById("preview-image");
  let preferences = { ...art.DEFAULTS };
  let revision = 0;
  let pending = Promise.resolve();
  const descriptions = {
    friendly: "Warm reminders and a gentle bounce. Your encouraging little buddy.",
    playful: "Quest-inspired reminders and a livelier bounce. Breaks are an adventure!",
    sassy: "Cheeky reminders and a laid-back bounce. Same helpful break schedule.",
  };
  function render() {
    window.MascotImages.draw(preview, previewImage, preferences.size, document.getElementById("preview-mood").value, window.devicePixelRatio || 1);
    preview.setAttribute("data-personality", preferences.personality);
    preview.setAttribute("data-emotion", document.getElementById("preview-mood").value);
    document.getElementById("size-value").textContent = `${preferences.size}%`;
    document.getElementById("personality-description").textContent = descriptions[preferences.personality];
    preview.setAttribute("aria-label", `Uploaded mascot, ${document.getElementById("preview-mood").value}, ${preferences.size}%`);
  }
  function save() {
    const value = { ...preferences };
    const version = ++revision;
    status.textContent = "Saving…"; retry.hidden = true;
    // Queue writes so rapid slider changes cannot persist out of order.
    pending = pending.then(async () => {
      if (version !== revision) return;
      try {
        const result = await window.mascotSettings.save(value);
        if (version !== revision) return;
        if (!result.ok) throw new Error(result.error);
        status.textContent = "Saved on this Mac · Changes apply automatically.";
      } catch {
        if (version !== revision) return;
        status.textContent = "Changes could not be saved. Try again."; retry.hidden = false;
      }
    });
  }
  for (const key of fields) {
    document.getElementById(key).addEventListener("input", event => {
      preferences = art.normalize({ ...preferences, [key]: key === "size" ? Number(event.target.value) : event.target.value });
      render(); save();
    });
  }
  document.getElementById("preview-mood").addEventListener("change", render);
  document.getElementById("customization").addEventListener("submit", event => event.preventDefault());
  retry.addEventListener("click", save);
  window.mascotSettings.get().then(value => {
    preferences = art.normalize(value);
    for (const key of ["size", "personality"]) document.getElementById(key).value = preferences[key];
    // Retain legacy preferences on disk, but do not apply them to supplied art.
    controls.disabled = false; render(); status.textContent = "Saved on this Mac · Changes apply automatically.";
  }).catch(() => { status.textContent = "Could not load preferences. Close and reopen this window to retry."; });
})();
