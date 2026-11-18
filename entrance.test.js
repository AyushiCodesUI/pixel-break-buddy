const { test } = require("node:test");
const assert = require("node:assert/strict");
const entrance = require("./entrance");

test("entrance cruises linearly then brakes smoothly in the last quarter", () => {
  const p = entrance.progress;
  assert.equal(p(0), 0);
  assert.equal(p(2000), 1);
  assert.equal(p(3000), 1);
  assert.ok(Math.abs((p(1000) - p(500)) - (p(1500) - p(1000))) < 1e-10);
  const early = p(1600) - p(1500);
  const late = p(2000) - p(1900);
  assert.ok(late < early / 5);
  const before = p(1500) - p(1499), after = p(1501) - p(1500);
  assert.ok(Math.abs(before - after) < 0.000002, "no speed discontinuity at braking");
});

test("distance-driven steps stay ordered and land in the feet-together frame", () => {
  let lastFrame = 0;
  let transitions = 0;
  for (let time = 0; time <= 2000; time++) {
    const sample = entrance.sample(time, 200, 2);
    if (sample.frame !== lastFrame) {
      assert.equal(sample.frame, (lastFrame + 1) % 6);
      lastFrame = sample.frame; transitions++;
    }
  }
  assert.equal(transitions, 13);
  assert.equal(lastFrame, 1);
  assert.equal(entrance.sample(2000, 200).stopped, true);
});

test("position is monotonic, pixel-snapped, and reaches zero at all supported sizes and screen densities", () => {
  for (const distance of [137, 185, 241, 300]) for (const dpr of [1, 2]) {
    let previous = Infinity;
    for (let time = 0; time <= 2000; time += 8) {
      const { x } = entrance.sample(time, distance, dpr);
      assert.ok(x <= previous && x >= 0);
      assert.equal(x * dpr % 1, 0);
      previous = x;
    }
    assert.equal(previous, 0);
  }
});
