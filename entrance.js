(function (root) {
  const DURATION = 2000;
  const SETTLE = 140;
  // Constant velocity for 75% of the time, then smoothly reduce velocity
  // to zero. Position and speed are continuous at the braking point.
  function progress(elapsed) {
    const t = Math.min(1, Math.max(0, elapsed / DURATION));
    if (t <= 0.75) return t / 0.875;
    const end = (t - 0.75) / 0.25;
    return (0.75 + 0.25 * (end - end * end / 2)) / 0.875;
  }
  function sample(elapsed, distance, dpr = 1) {
    const traveled = progress(elapsed);
    return {
      x: Math.round(distance * (1 - traveled) * dpr) / dpr,
      // Two cycles plus one step ends on the supplied feet-together pose.
      // Frame phase follows distance, so the cadence slows with velocity.
      frame: Math.min(13, Math.floor(traveled * 13 + 1e-9)) % 6,
      stopped: elapsed >= DURATION,
    };
  }
  const api = { DURATION, SETTLE, progress, sample };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BuddyEntrance = api;
})(globalThis);
