const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const images = require("./mascot-images");

test("walking frames advance left to right then across the second row at 8 fps", () => {
  assert.equal(images.WALK.fps, 8);
  assert.equal(images.WALK.duration, 2000);
  assert.deepEqual([0, 125, 250, 375, 500, 625, 750].map(images.walkingFrame), [0, 1, 2, 3, 4, 5, 0]);
  assert.equal(images.walkingFrame(124), 0);
  assert.equal(images.walkingFrame(749), 5);
  const sheet = fs.readFileSync(path.join(__dirname, images.WALK.source));
  assert.equal(sheet.readUInt32BE(16), images.WALK.frameSize * images.WALK.frames);
  assert.equal(sheet.readUInt32BE(20), images.WALK.frameSize);
});

// SHA-256 fingerprints of the original supplied PNGs.
const ORIGINAL_HASHES = {"happy": "2e7ea6cd1950fdde0091bfefe92e90015c62ae34690d855118bda51a5a50877d", "annoyed": "d913d182fe4b997b62f241b391651b2bc260323a9cd33be9fe97256a2354e42a", "angry": "d182ade3346ee6a0685828ddb773e6b00052a355d93037c3ad8ec6c42b57d05a"};

test("all three image mappings load PNG files copied byte for byte from the supplied artwork", () => {
  for (const emotion of ["happy", "annoyed", "angry"]) {
    assert.equal(images.SOURCES[emotion], `assets/mascot/state-${emotion}.png`);
    const actual = fs.readFileSync(path.join(__dirname, images.SOURCES[emotion]));
    assert.equal(createHash("sha256").update(actual).digest("hex"), ORIGINAL_HASHES[emotion]);
    assert.equal(actual.subarray(1, 4).toString(), "PNG");
    assert.equal(actual.readUInt32BE(16), images.WIDTH);
    assert.equal(actual.readUInt32BE(20), images.HEIGHT);
  }
});

test("image sizing retains aspect ratio, snaps to screen pixels, and avoids redundant source changes", () => {
  let changes = 0;
  const element = { style: {} };
  const image = { style: {}, getAttribute() { return this.src; }, setAttribute(_key, value) { this.src = value; changes++; } };
  for (const dpr of [1, 2]) for (let size = 70; size <= 140; size++) {
    const dimensions = images.draw(element, image, size, "happy", dpr);
    assert.equal(dimensions.width * dpr % 1, 0);
    assert.equal(dimensions.height * dpr % 1, 0);
    assert.ok(Math.abs(dimensions.height - dimensions.width * images.HEIGHT / images.WIDTH) <= 0.5 / dpr);
    assert.ok(dimensions.width <= 224);
    assert.ok(dimensions.height <= 205);
  }
  assert.equal(changes, 1);
  images.draw(element, image, 100, "annoyed");
  assert.equal(image.src, images.SOURCES.annoyed);
  images.draw(element, image, 100, "angry");
  assert.equal(image.src, images.SOURCES.angry);
  images.draw(element, image, 100, "invalid");
  assert.equal(image.src, images.SOURCES.happy);
});
