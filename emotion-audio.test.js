const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CUES, createPlayer, createGate } = require("./emotion-audio");
function fakeContext() {
  const parameter = () => ({ events: [], setValueAtTime(value, time) { this.events.push({ value, time }); }, linearRampToValueAtTime(value, time) { this.events.push({ value, time }); } });
  const context = { state: "running", currentTime: 1, destination: {}, oscillators: [], gains: [],
    createGain() { const gain = { gain: parameter(), connect() {}, disconnect() {} }; this.gains.push(gain); return gain; },
    createOscillator() { const oscillator = { frequency: parameter(), stops: [], connect() {}, disconnect() {}, start(time) { this.startTime = time; }, stop(time) { this.stops.push(time); } }; this.oscillators.push(oscillator); return oscillator; },
    resume: async () => { context.state = "running"; },
  };
  return context;
}

test("original retro cues have distinct shapes and requested short durations", () => {
  assert.equal(CUES.happy.length, 2);
  assert.ok(CUES.happy[1].frequency > CUES.happy[0].frequency);
  assert.equal(CUES.annoyed.length, 2);
  assert.ok(CUES.annoyed.every(note => note.duration < 0.15));
  assert.equal(CUES.angry[0].buzz, true);
  for (const [emotion, low, high] of [["happy", 0.4, 0.6], ["annoyed", 0.3, 0.5], ["angry", 0.4, 0.7]]) {
    const duration = Math.max(...CUES[emotion].map(note => note.at + note.duration));
    assert.ok(duration >= low && duration <= high);
  }
});

test("one lazy AudioContext serves all cues, previews, volume levels and cancellation", async () => {
  const context = fakeContext(); let contexts = 0;
  const player = createPlayer(() => { contexts++; return context; });
  assert.equal(await player.play("happy"), false);
  assert.equal(contexts, 0, "muted sounds do not allocate an AudioContext");
  player.configure({ sounds: true, soundVolume: 25 });
  assert.equal(await player.play("happy"), true);
  assert.equal(context.oscillators.length, 2);
  assert.equal(context.gains[0].gain.events.at(-1).value, 0.03);
  const first = context.oscillators[0];
  await player.play("angry", 50);
  assert.equal(first.stops.length, 2, "previous voice is stopped before a new cue starts");
  assert.equal(context.gains[0].gain.events.at(-1).value, 0.06);
  assert.equal(contexts, 1);
  assert.equal(context.oscillators.at(-1).type, "square");
  player.configure({ sounds: false, soundVolume: 50 });
  assert.equal(context.oscillators.at(-1).stops.length, 2);
  assert.equal(await player.play("annoyed"), false);
  player.configure({ sounds: true, soundVolume: 0 });
  assert.equal(await player.play("angry"), false);
  assert.equal(contexts, 1);
});

test("a dismissed, superseded or muted pending audio resume cannot play late", async () => {
  const context = fakeContext(); context.state = "suspended";
  let resume;
  context.resume = () => new Promise(resolve => { resume = () => { context.state = "running"; resolve(); }; });
  const player = createPlayer(() => context);
  player.configure({ sounds: true, soundVolume: 25 });
  const pending = player.play("happy");
  player.stop(); resume();
  assert.equal(await pending, false);
  assert.equal(context.oscillators.length, 0);
  context.state = "suspended";
  const second = player.play("annoyed");
  player.configure({ sounds: false, soundVolume: 25 }); resume();
  assert.equal(await second, false);
  assert.equal(context.oscillators.length, 0);
});

test("main-process sound gate allows one settled cue per emotion per reminder appearance", () => {
  const gate = createGate();
  let state = { phase: "reminder", appearance: 1, emotion: "happy" };
  const prefs = { sounds: true, soundVolume: 25 };
  const request = () => ({ appearance: state.appearance, emotion: state.emotion });
  assert.equal(gate.accept(state, request(), prefs, false), false, "hidden mascot is silent");
  assert.equal(gate.accept(state, request(), prefs, true), true);
  assert.equal(gate.accept(state, request(), prefs, true), false, "focus/reload does not replay");
  state.emotion = "annoyed";
  assert.equal(gate.accept(state, { appearance: 1, emotion: "happy" }, prefs, true), false);
  assert.equal(gate.accept(state, request(), prefs, true), true);
  assert.equal(gate.accept(state, request(), prefs, true), false);
  state.emotion = "angry";
  assert.equal(gate.accept(state, request(), prefs, true), true);
  assert.equal(gate.accept(state, request(), prefs, true), false);
  state.phase = "break";
  assert.equal(gate.accept(state, request(), prefs, true), false);
  state = { phase: "reminder", appearance: 2, emotion: "happy" };
  assert.equal(gate.accept(state, request(), { ...prefs, sounds: false }, true), false);
  assert.equal(gate.accept(state, request(), prefs, true), false, "enabling sounds does not replay a muted transition");
  state.appearance = 3;
  assert.equal(gate.accept(state, { appearance: 2, emotion: "happy" }, prefs, true), false);
  assert.equal(gate.accept(state, request(), prefs, true), true);
});

test("rapid queued emotion changes keep only the newest sound after AudioContext resumes", async () => {
  const context = fakeContext(); context.state = "suspended";
  const resumes = [];
  context.resume = () => new Promise(resolve => resumes.push(() => { context.state = "running"; resolve(); }));
  const player = createPlayer(() => context);
  player.configure({ sounds: true, soundVolume: 25 });
  const old = player.play("happy");
  const latest = player.play("angry");
  resumes.forEach(resume => resume());
  assert.equal(await old, false);
  assert.equal(await latest, true);
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].frequency.events[0].value, 196);
});
