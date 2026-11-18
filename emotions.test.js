const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sample } = require("./emotions");
const { draw, drawLayer, ALIGNMENT, WIDTH, HEIGHT } = require("./mascot-images");

test("annoyed swaps once at peak compression during a 110ms blink and settles in 400ms", () => {
  assert.equal(sample("annoyed", 99).scaleY, 1);
  assert.equal(sample("annoyed", 100).y, 2);
  assert.equal(sample("annoyed", 154).swap, false);
  assert.equal(sample("annoyed", 155).swap, true);
  assert.equal(sample("annoyed", 155).scaleY, 0.92);
  assert.equal(sample("annoyed", 210).scaleY, 1);
  assert.equal(sample("annoyed", 399).done, false);
  assert.deepEqual(sample("annoyed", 400), { swap: true, scaleY: 1, x: 0, y: 0, done: true, duration: 400 });
});

test("angry swaps while compressed, uses controlled 2.5px shaking and rests after 500ms", () => {
  assert.equal(sample("angry", 174).swap, false);
  assert.equal(sample("angry", 175).swap, true);
  assert.equal(sample("angry", 175).scaleY, 0.92);
  const offsets = [];
  for (let time = 0; time <= 500; time++) {
    const pose = sample("angry", time, -2);
    assert.ok(Math.abs(pose.x) <= 2.5);
    assert.ok(pose.y >= -2 && pose.y <= 2);
    assert.ok(pose.scaleY >= 0.92 && pose.scaleY <= 1);
    assert.equal(Object.hasOwn(pose, "blend"), false);
    offsets.push(pose.x);
  }
  assert.ok(offsets.some(x => x < -1) && offsets.some(x => x > 1));
  assert.deepEqual(sample("angry", 500), { swap: true, scaleY: 1, x: 0, y: 0, done: true, duration: 500 });
});

test("unchanged PNG layers have equal stature, horizontal anchor and foot baseline at every size", () => {
  const element = { style: {} };
  const layer = () => ({ style: {}, getAttribute() { return this.src; }, setAttribute(_key, value) { this.src = value; } });
  for (const dpr of [1, 2]) for (let size = 70; size <= 140; size++) {
    const dimensions = draw(element, layer(), size, "happy", dpr);
    const reference = ALIGNMENT.happy;
    const base = dimensions.width / WIDTH;
    for (const emotion of ["happy", "annoyed", "angry"]) {
      const image = layer();
      drawLayer(image, dimensions, emotion, dpr);
      const scale = parseFloat(image.style.width) / WIDTH;
      const pose = ALIGNMENT[emotion];
      assert.ok(Math.abs(parseFloat(image.style.top) + pose.ground * scale - reference.ground * base) <= 0.5 / dpr + 1e-8);
      assert.ok(Math.abs(parseFloat(image.style.left) + pose.center * scale - reference.center * base) <= 0.5 / dpr + 1e-8);
      assert.ok(Math.abs((pose.ground - pose.head) * scale - (reference.ground - reference.head) * base) < 0.4);
      assert.ok(Math.abs(parseFloat(image.style.height) / parseFloat(image.style.width) - HEIGHT / WIDTH) < 1e-10);
    }
  }
});
