(function (root) {
  // These are the original, unmodified PNGs supplied for Pixel Break Buddy.
  const SOURCES = Object.freeze({
    happy: "assets/mascot/state-happy.png",
    annoyed: "assets/mascot/state-annoyed.png",
    angry: "assets/mascot/state-angry.png",
  });
  const WIDTH = 1312;
  const HEIGHT = 1199;
  // Measured character bounds, excluding floating mood symbols and shadows.
  // Uniform scaling around these foot/ground anchors keeps stature stable.
  const ALIGNMENT = Object.freeze({
    happy: { head: 143, ground: 1064, center: 657 },
    annoyed: { head: 192, ground: 1044, center: 658 },
    angry: { head: 158, ground: 1072, center: 660 },
  });
  function drawLayer(image, dimensions, emotion = "happy", dpr = 1) {
    const pose = ALIGNMENT[emotion] || ALIGNMENT.happy;
    const reference = ALIGNMENT.happy;
    const base = dimensions.width / WIDTH;
    const uniform = (reference.ground - reference.head) / (pose.ground - pose.head);
    const width = Math.round(dimensions.width * uniform * dpr) / dpr;
    const scale = width / WIDTH;
    const snap = value => Math.round(value * dpr) / dpr;
    const source = SOURCES[emotion] || SOURCES.happy;
    if (image.getAttribute("src") !== source) image.setAttribute("src", source);
    Object.assign(image.style, {
      position: "absolute", width: `${width}px`, height: `${width * HEIGHT / WIDTH}px`,
      left: `${snap(reference.center * base - pose.center * scale)}px`,
      top: `${snap(reference.ground * base - pose.ground * scale)}px`,
    });
  }
  const WALK = Object.freeze({ source: "assets/mascot/walking-aligned.png", frameSize: 512, frames: 6, fps: 8, duration: 2000 });
  function walkingFrame(elapsed) {
    return Math.floor(Math.max(0, elapsed) / (1000 / WALK.fps)) % WALK.frames;
  }
  function draw(element, image, size = 100, emotion = "happy", dpr = 1) {
    const percent = Number.isFinite(size) ? Math.min(140, Math.max(70, size)) : 100;
    const snap = value => Math.round(value * dpr) / dpr;
    const width = snap(160 * percent / 100);
    const height = snap(width * HEIGHT / WIDTH);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    drawLayer(image, { width, height }, emotion, dpr);
    return { width, height };
  }
  const api = { SOURCES, WIDTH, HEIGHT, ALIGNMENT, WALK, walkingFrame, draw, drawLayer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MascotImages = api;
})(globalThis);
