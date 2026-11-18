const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("renderer starts with an immutable preload bridge and renders reminders", () => {
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {
      style: {}, children: [], hidden: false,
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      appendChild(child) { this.children.push(child); },
      setAttribute(key, value) { this[key] = value; },
      getAttribute(key) { return this[key]; },
      addEventListener(key, callback) { this[key] = callback; },
      getBoundingClientRect() { return { left: 116 }; },
    };
  }
  let receiveState;
  let receivePreferences;
  const soundRequests = [];
  let playAudio, audioPreferences, stopAudio;
  const playerCalls = [];
  const player = { configure() {}, stop() {}, play(emotion, volume) { playerCalls.push({ emotion, volume }); return Promise.resolve(true); } };
  let ready = false;
  let action;
  let nextTask = 0;
  const frames = new Map();
  let frameId = 0;
  const advance = timestamp => {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(timestamp); }
  };
  const tasks = new Map();
  const schedule = (callback, delay) => { const id = ++nextTask; tasks.set(id, { callback, delay }); return id; };
  const runDelay = delay => {
    for (const [id, task] of [...tasks]) if (task.delay === delay) { tasks.delete(id); task.callback(); }
  };
  const motion = { matches: false, addEventListener(_event, callback) { this.change = callback; } };
  const context = vm.createContext({
    console: { log() {}, error() {} },
    addEventListener() {},
    matchMedia: () => motion,
    innerWidth: 300,
    EmotionAudio: { createPlayer: () => player },
    BuddyEntrance: require("./entrance"),
    BuddyEmotions: require("./emotions"),
    getComputedStyle: () => ({ transform: "none" }),
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    MascotArt: require("./mascot-art"),
    MascotImages: require("./mascot-images"),
    setTimeout: schedule, setInterval: schedule,
    clearTimeout: id => tasks.delete(id), clearInterval: id => tasks.delete(id),
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: element,
    },
  });
  // contextBridge exposes a non-configurable window property. A separate
  // mock window object misses the global lexical-name collision this caused.
  Object.defineProperty(context, "buddy", {
    configurable: false,
    writable: false,
    value: {
      onState(callback) { receiveState = callback; },
      onPreferences(callback) { receivePreferences = callback; },
      onAudioPreferences(callback) { audioPreferences = callback; },
      onPlayAudio(callback) { playAudio = callback; },
      onStopAudio(callback) { stopAudio = callback; },
      emotionSound(request) { soundRequests.push(request); },
      ready() { ready = true; },
      takeBreak() { action = "take-break"; },
      snooze() { action = "snooze"; },
      setInteractive() {},
    },
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(require.resolve("./renderer.js"), "utf8"), context);
  assert.equal(ready, true);
  assert.equal(elements.get("mascot").children.length, 0, "no placeholder pixels are created");
  receiveState({ phase: "work", emotion: "happy", appearance: 0, testMode: true });
  assert.equal(elements.get("buddy").hidden, true);
  for (const emotion of ["happy", "annoyed", "angry"]) {
    receiveState({ phase: "reminder", emotion, appearance: 1, testMode: true });
    assert.equal(elements.get("buddy").hidden, false);
    if (emotion === "happy") {
      assert.equal(elements.get("bubble").hidden, true, "bubble waits for the walk");
      assert.equal(soundRequests.length, 0, "happy sound waits until entrance completes");
      assert.equal(elements.get("walker").classList.contains("walking"), true);
      assert.equal(elements.get("mascot-image").hidden, false, "idle image is prepainted but transparent through CSS");
      assert.equal(elements.get("walking-sprite").hidden, false);
      assert.equal(elements.get("walking-sprite").style.backgroundPosition, "0% 0");
      advance(0);
      advance(375);
      assert.notEqual(elements.get("walking-sprite").style.backgroundPosition, "0% 0");
      assert.equal(frames.size, 1);
      const timerCount = tasks.size;
      receivePreferences({ ...require("./mascot-art").DEFAULTS, design: "cat", color: "mint", size: 140, accessory: "bow" });
      assert.equal(tasks.size, timerCount, "appearance changes do not restart walking");
      assert.equal(elements.get("mascot").style.width, "224px");
      assert.equal(elements.get("walker").classList.contains("walking"), true);
      receivePreferences(require("./mascot-art").DEFAULTS);
      assert.equal(elements.get("mascot-image").src, "assets/mascot/state-happy.png");
      advance(2000);
      assert.equal(elements.get("walker").style.transform, "translateX(0px)");
      assert.equal(elements.get("bubble").hidden, true, "bubble waits for the planted-pose transition");
      assert.equal(elements.get("walker").classList.contains("settling"), true);
      runDelay(140);
      assert.equal(elements.get("walker").classList.contains("walking"), false);
      assert.equal(elements.get("mascot-image").hidden, false);
      assert.equal(elements.get("walking-sprite").hidden, true);
      assert.equal(elements.get("bubble").hidden, false);
      assert.equal(elements.get("bubble").classList.contains("revealing"), true);
      elements.get("mascot").click();
      assert.equal(elements.get("bubble").hidden, true);
      elements.get("mascot").click();
      assert.equal(elements.get("bubble").hidden, false);
    }
    if (emotion !== "happy") {
      const previous = emotion === "annoyed" ? "happy" : "annoyed";
      assert.equal(elements.get("mascot-image").src, `assets/mascot/state-${previous}.png`);
      const previousMessage = elements.get("message")["aria-label"];
      assert.equal(elements.get("mascot").classList.contains("transitioning"), true);
      const start = emotion === "annoyed" ? 3000 : 4000;
      advance(start);
      const swapAt = emotion === "angry" ? 175 : 155;
      advance(start + swapAt - 1);
      assert.equal(elements.get("mascot-image").src, `assets/mascot/state-${previous}.png`);
      advance(start + swapAt);
      assert.equal(elements.get("mascot-image").src, `assets/mascot/state-${emotion}.png`);
      assert.ok(elements.get("mascot").style.transform.includes("scaleY(0.92)"));
      assert.equal(elements.has("mascot-next-image"), false, "only one expression image exists");
      assert.equal(elements.get("mascot-image").style.opacity, undefined, "emotion transitions never alter opacity");
      assert.equal(elements.get("message")["aria-label"], previousMessage, "message waits until expression settles");
      receiveState({ phase: "reminder", emotion, appearance: 1 });
      assert.equal(frames.size, 1, "repeated timer snapshots do not restart transitions");
      advance(start + (emotion === "angry" ? 500 : 400));
      assert.equal(elements.get("mascot").classList.contains("transitioning"), false);
      assert.equal(frames.size, 0);
      assert.notEqual(elements.get("message")["aria-label"], previousMessage);
    }
    assert.equal(elements.get("mascot")["aria-label"], `${emotion} pixel art buddy; toggle reminder`);
    assert.equal(elements.get("mascot-image").src, `assets/mascot/state-${emotion}.png`);
    assert.equal(soundRequests.at(-1).emotion, emotion);
  }
  assert.deepEqual(soundRequests.map(request => request.emotion), ["happy", "annoyed", "angry"]);
  playAudio({ emotion: "angry", volume: 25 });
  assert.equal(playerCalls.length, 1);
  elements.get("take-break").click();
  assert.equal(action, "take-break");
  playAudio({ emotion: "angry", volume: 25 });
  assert.equal(playerCalls.length, 1, "dismissal cancels a queued playback command");
  elements.get("snooze").click();
  assert.equal(action, "snooze");
  receiveState({ phase: "break", emotion: "happy", appearance: 1, remainingSeconds: 15 });
  assert.equal(elements.get("countdown").textContent, "0:15");
  assert.equal(elements.get("actions").hidden, true);
  receiveState({ phase: "work", emotion: "happy", appearance: 1 });
  assert.equal(elements.get("buddy").hidden, true);
  assert.equal(tasks.size, 0, "hidden mascot has no animation timers");
  motion.matches = true;
  receiveState({ phase: "reminder", emotion: "happy", appearance: 2 });
  assert.equal(elements.get("bubble").hidden, false, "reduced motion skips the walk");
  assert.equal(tasks.size, 0, "reduced motion has no animation timers");
  assert.equal(elements.get("message").textContent, "Time for a little break!");
  receivePreferences({ ...require("./mascot-art").DEFAULTS, design: "bunny", personality: "sassy", size: 70 });
  assert.equal(elements.get("message").textContent, "Break time, superstar.");
  assert.equal(elements.get("mascot").style.width, "112px");
  assert.equal(elements.get("mascot")["aria-label"], "happy pixel art buddy; toggle reminder");
  receiveState({ phase: "break", emotion: "happy", appearance: 2, remainingSeconds: 12 });
  receivePreferences({ ...require("./mascot-art").DEFAULTS, color: "purple", accessory: "glasses" });
  assert.equal(elements.get("countdown").textContent, "0:12");
  assert.equal(elements.get("message").textContent, "Enjoy your break!");
  assert.equal(elements.get("mascot-image").src, "assets/mascot/state-happy.png");
  // One renderer clock drives movement and frames; arrival cancels the loop.
  motion.matches = false;
  receiveState({ phase: "work", emotion: "happy", appearance: 2 });
  receiveState({ phase: "reminder", emotion: "happy", appearance: 3 });
  assert.equal(frames.size, 1);
  advance(3000);
  advance(5000);
  runDelay(140);
  assert.equal(elements.get("walking-sprite").hidden, true);
  assert.equal(elements.get("mascot-image").hidden, false);
  assert.equal(frames.size, 0);
  receiveState({ phase: "snooze", emotion: "happy", appearance: 3 });
  receiveState({ phase: "reminder", emotion: "happy", appearance: 4 });
  receiveState({ phase: "work", emotion: "happy", appearance: 4 });
  assert.equal(tasks.size, 0, "hiding midway through walking cancels the frame loop");
  assert.equal(frames.size, 0);
  receiveState({ phase: "reminder", emotion: "happy", appearance: 5 });
  assert.equal(frames.size, 1);
  motion.matches = true;
  motion.change();
  assert.equal(frames.size, 0, "enabling reduced motion cancels an active entrance");
  assert.equal(tasks.size, 0);
  assert.equal(elements.get("walking-sprite").hidden, true);
  assert.equal(elements.get("walker").style.transform, "translateX(0px)");
  assert.equal(elements.get("bubble").hidden, false);
  // An incoming state can interrupt a blink without leaving two loops alive.
  motion.matches = false;
  receiveState({ phase: "reminder", emotion: "annoyed", appearance: 5 });
  advance(10000); advance(10200);
  receiveState({ phase: "reminder", emotion: "angry", appearance: 5 });
  assert.equal(frames.size, 1);
  advance(10300); advance(10800);
  assert.equal(elements.get("mascot-image").src, "assets/mascot/state-angry.png");
  receiveState({ phase: "reminder", emotion: "happy", appearance: 5 });
  advance(11000);
  motion.matches = true;
  motion.change();
  assert.equal(frames.size, 0);
  assert.equal(tasks.size, 0);
  assert.equal(elements.get("mascot-image").src, "assets/mascot/state-happy.png");
  motion.matches = false;
  receiveState({ phase: "reminder", emotion: "annoyed", appearance: 5 });
  advance(12000); advance(12200);
  receiveState({ phase: "break", emotion: "happy", appearance: 5, remainingSeconds: 15 });
  assert.equal(frames.size, 0, "taking a break cancels the pending mood transition");
  assert.equal(elements.get("mascot-image").src, "assets/mascot/state-happy.png");
  assert.equal(elements.get("message")["aria-label"], "Enjoy your break!");
  assert.equal(elements.get("countdown").textContent, "0:15");
  motion.matches = true;
  receiveState({ phase: "work", emotion: "happy", appearance: 5 });
  receiveState({ phase: "reminder", emotion: "happy", appearance: 6 });
  motion.matches = false;
  receiveState({ phase: "reminder", emotion: "annoyed", appearance: 6 });
  advance(13000); advance(13050);
  receiveState({ phase: "reminder", emotion: "angry", appearance: 6 });
  assert.equal(elements.get("mascot-image").src, "assets/mascot/state-happy.png", "an interrupted blink must not flash its obsolete target");
  assert.equal(frames.size, 1);
  advance(14000); advance(14175);
  assert.equal(elements.get("mascot-image").src, "assets/mascot/state-angry.png");
  assert.equal(elements.get("message")["aria-label"], "Time for a little break!");
  advance(14500);
  assert.equal(elements.get("message")["aria-label"], "Break time. Seriously!");
  assert.equal(frames.size, 0);
});
