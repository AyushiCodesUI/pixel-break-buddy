(function (root) {
  const DEFAULTS = Object.freeze({ design: "buddy", color: "yellow", size: 100, accessory: "none", personality: "friendly" });
  const OPTIONS = Object.freeze({ design: ["buddy", "cat", "bunny"], color: ["yellow", "pink", "mint", "blue", "purple"], accessory: ["none", "hat", "glasses", "bow"], personality: ["friendly", "playful", "sassy"] });
  const COLORS = { ".": "transparent", s: "#3d3424", y: "#f6c445", w: "#fff8e7", b: "#2a241c", c: "#ff9b7a", m: "#e07a3d" };
  const TINTS = { yellow: "#f6c445", pink: "#f2a6c2", mint: "#95d5b2", blue: "#99c8f2", purple: "#c4a4e8" };
  // Buddy's original outline and palette remain the default.
  const SPRITE = ["..............", "....ssssss....", "..ssyyyyyyss..", ".syyywwyywwys.", ".syyybbyybbys.", ".syycyyyyycys.", ".syyyyymmyyys.", "..ssyyyyyyss..", "....ssssss....", "...syyyyyys...", "..ssyyyyyyss..", ".syyyyssyyyys.", ".syyys..syyys.", ".ssss....ssss."];
  function normalize(value) {
    const result = { ...DEFAULTS };
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const [key, options] of Object.entries(OPTIONS)) if (options.includes(value[key])) result[key] = value[key];
    if (Number.isFinite(value.size)) result.size = Math.min(140, Math.max(70, Math.round(value.size)));
    return result;
  }
  function valid(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      && Object.entries(OPTIONS).every(([key, options]) => options.includes(value[key]))
      && Number.isInteger(value.size) && value.size >= 70 && value.size <= 140
      && Object.keys(value).every(key => Object.hasOwn(DEFAULTS, key));
  }
  function frame(preferences, pose = {}) {
    const prefs = normalize(preferences);
    const rows = SPRITE.map(row => row.split(""));
    const put = (y, x, color) => { rows[y][x] = color; };
    if (prefs.design === "cat") {
      rows[0] = "..ss......ss..".split("");
      rows[1] = "..syssssssys..".split("");
      put(2, 3, "c"); put(2, 10, "c");
      put(5, 1, "s"); put(5, 12, "s");
    } else if (prefs.design === "bunny") {
      rows[0] = "...ss...ss....".split("");
      rows[1] = "...scssscs....".split("");
      rows[2] = "..sscyyycsss..".split("");
    }
    const emotion = pose.emotion || "happy";
    if (emotion === "happy") {
      put(6, 6, "m"); put(6, 7, "y"); put(6, 8, "m"); put(7, 7, "m");
    } else if (emotion === "annoyed") {
      for (const x of [5, 6, 9, 10]) put(3, x, "s");
      for (const x of [6, 7, 8]) put(6, x, "m");
      for (const x of [4, 5, 8, 9]) put(10, x, "s");
    } else {
      put(3, 5, "s"); put(3, 10, "s"); put(4, 6, "s"); put(4, 9, "s");
      put(5, 7, "m"); put(6, 6, "m"); put(6, 7, "y"); put(6, 8, "m");
    }
    if (pose.gaze && !pose.walking) {
      for (const x of [5, 6, 9, 10]) put(4, x, "w");
      put(4, pose.gaze < 0 ? 5 : 6, "b"); put(4, pose.gaze < 0 ? 9 : 10, "b");
    }
    if (pose.blink) for (const x of [5, 6, 9, 10]) { put(3, x, "y"); put(4, x, "s"); }
    // Accessories share the sprite grid: they cannot drift during animation.
    if (prefs.accessory === "hat") {
      for (const x of [5, 6, 7, 8]) { put(0, x, "s"); put(1, x, "m"); }
      for (let x = 3; x <= 10; x++) put(2, x, "s");
    } else if (prefs.accessory === "glasses") {
      for (const x of [4, 5, 6, 7, 8, 9, 10, 11]) put(3, x, "s");
      for (const x of [4, 7, 8, 11]) put(4, x, "s");
      for (const x of [4, 5, 6, 7, 8, 9, 10, 11]) put(5, x, "s");
    } else if (prefs.accessory === "bow") {
      for (const x of [4, 5, 8, 9]) { put(8, x, "m"); put(9, x, "m"); }
      put(8, 6, "c"); put(8, 7, "c");
    }
    return rows.flat();
  }
  function draw(element, pixels, preferences, pose = {}, dpr = 1) {
    const prefs = normalize(preferences);
    const unit = 8 * prefs.size / 100;
    const snap = number => Math.round(number * dpr) / dpr;
    const palette = { ...COLORS, y: TINTS[prefs.color] };
    element.style.position = "relative";
    element.style.width = `${snap(14 * unit)}px`;
    element.style.height = `${snap(14 * unit)}px`;
    frame(prefs, pose).forEach((cell, index) => {
      const x = index % 14, y = Math.floor(index / 14);
      const style = pixels[index].style;
      style.position = "absolute";
      style.left = `${snap(x * unit)}px`; style.top = `${snap(y * unit)}px`;
      style.width = `${snap((x + 1) * unit) - snap(x * unit)}px`;
      style.height = `${snap((y + 1) * unit) - snap(y * unit)}px`;
      style.background = palette[cell];
      style.transform = pose.walking && y >= 12 ? `translateY(${snap((x < 7 ? pose.stride : -pose.stride) * unit / 2)}px)` : "";
    });
    return snap(14 * unit);
  }
  const api = { DEFAULTS, OPTIONS, normalize, valid, frame, draw };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MascotArt = api;
})(globalThis);
