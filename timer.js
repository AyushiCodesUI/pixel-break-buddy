// Keep timing separate from the window so it can be checked without Electron.
const NORMAL_TIMINGS = { work: 3600000, annoyed: 120000, angry: 180000, break: 300000, snooze: 600000 };
const TEST_TIMINGS = { work: 20000, annoyed: 5000, angry: 10000, break: 15000, snooze: 10000 };

function createTimer(timings, now = Date.now) {
  timings = { ...timings };
  let phase = "work";
  let startedAt = now();
  let deadline = startedAt + timings.work;
  let appearance = 0;
  let pausedAt = null;
  let previewStartedAt = null;
  let previewAppearance;

  function start(next, time, duration) {
    phase = next;
    pausedAt = null;
    startedAt = time;
    deadline = duration === null ? null : time + duration;
    if (next === "reminder") appearance += 1;
  }

  function snapshot() {
    const time = pausedAt === null ? now() : pausedAt;
    if (phase === "work" || phase === "snooze") {
      // On wake from sleep, present a fresh reminder rather than an angry one.
      if (time >= deadline) start("reminder", time, null);
    } else if (phase === "break" && time >= deadline) {
      start("work", time, timings.work);
    }
    const elapsed = time - startedAt;
    const emotion = phase === "reminder"
      ? elapsed >= timings.angry ? "angry" : elapsed >= timings.annoyed ? "annoyed" : "happy"
      : "happy";
    if (previewStartedAt !== null) {
      const previewElapsed = now() - previewStartedAt;
      return { phase: "reminder", emotion: previewElapsed >= TEST_TIMINGS.angry ? "angry" : previewElapsed >= TEST_TIMINGS.annoyed ? "annoyed" : "happy",
        appearance: previewAppearance, remainingSeconds: 0, durationSeconds: 0, paused: false, preview: true };
    }
    return { phase, emotion, appearance, remainingSeconds: deadline === null ? 0 : Math.max(0, Math.ceil((deadline - time) / 1000)),
      durationSeconds: deadline === null ? 0 : (deadline - startedAt) / 1000, paused: pausedAt !== null };
  }

  function act(action) {
    if (previewStartedAt !== null) return control("end-preview");
    snapshot();
    if (phase !== "reminder") return snapshot();
    if (action === "take-break") start("break", now(), timings.break);
    if (action === "snooze") start("snooze", now(), timings.snooze);
    return snapshot();
  }

  function configure(next) {
    if (!["work", "break", "snooze", "annoyed", "angry"].every(key => Number.isFinite(next?.[key]) && next[key] > 0)) {
      throw new Error("Invalid timer configuration");
    }
    // Existing startedAt/deadline remain intact. Only future phases use this.
    timings = { ...next };
  }
  function control(action) {
    if (action === "show-preview") {
      if (previewStartedAt === null) { previewStartedAt = now(); appearance += 1; previewAppearance = -appearance; }
      return snapshot();
    }
    if (action === "end-preview") {
      if (previewStartedAt !== null) { previewStartedAt = null; appearance += 1; }
      return snapshot();
    }
    // Preview controls cannot alter the real session or its pause state.
    if (previewStartedAt !== null) return snapshot();
    snapshot();
    if (action === "pause" && pausedAt === null) pausedAt = now();
    else if (action === "resume" && pausedAt !== null) {
      const shift = now() - pausedAt;
      startedAt += shift;
      if (deadline !== null) deadline += shift;
      pausedAt = null;
    } else if (action === "restart") start("work", now(), timings.work);
    else if (action === "break-now") start("break", now(), timings.break);
    return snapshot();
  }
  return { snapshot, act, configure, control, getTimings: () => ({ ...timings }) };
}

module.exports = { createTimer, NORMAL_TIMINGS, TEST_TIMINGS };
