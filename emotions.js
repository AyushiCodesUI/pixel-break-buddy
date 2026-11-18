(function (root) {
  const smooth = t => t * t * (3 - 2 * t);
  function sample(target, elapsed, initialY = 0) {
    const angry = target === "angry";
    const duration = angry ? 500 : 400;
    const dipEnd = angry ? 120 : 100;
    const blinkEnd = dipEnd + 110;
    const swapAt = dipEnd + 55;
    const t = Math.max(0, elapsed);
    let x = 0, y = 2, scaleY = 1;
    if (t < dipEnd) y = initialY + (2 - initialY) * smooth(t / dipEnd);
    else if (t < blinkEnd) {
      const phase = (t - dipEnd) / 110;
      // A small, stepped squash supplies the blink without editing the art.
      // The image changes once, at maximum compression; opacity stays at 1.
      scaleY = Math.round((1 - 0.08 * Math.sin(Math.PI * phase)) * 50) / 50;
    } else {
      const settle = Math.min(1, (t - blinkEnd) / (duration - blinkEnd));
      y = 2 * (1 - smooth(settle));
      if (angry) x = 2.5 * Math.sin(settle * Math.PI * 6) * (1 - settle);
    }
    if (t >= duration) { x = 0; y = 0; scaleY = 1; }
    return { swap: t >= swapAt, scaleY, x, y, done: t >= duration, duration };
  }
  const api = { sample };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BuddyEmotions = api;
})(globalThis);
