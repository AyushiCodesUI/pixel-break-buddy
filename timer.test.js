const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createTimer, NORMAL_TIMINGS, TEST_TIMINGS } = require("./timer");

for (const [name, timings] of Object.entries({ normal: NORMAL_TIMINGS, test: TEST_TIMINGS })) {
  test(`${name}: work, emotion boundaries, break and reset`, () => {
    let time = 0;
    const timer = createTimer(timings, () => time);
    assert.equal(timer.snapshot().phase, "work");
    time = timings.work - 1;
    assert.equal(timer.snapshot().phase, "work");
    time++;
    assert.equal(timer.snapshot().phase, "reminder");
    assert.equal(timer.snapshot().emotion, "happy");
    time += timings.annoyed - 1;
    assert.equal(timer.snapshot().emotion, "happy");
    time++;
    assert.equal(timer.snapshot().emotion, "annoyed");
    time = timings.work + timings.angry;
    assert.equal(timer.snapshot().emotion, "angry");
    const state = timer.act("take-break");
    assert.equal(state.phase, "break");
    assert.equal(state.remainingSeconds, timings.break / 1000);
    // Repeated clicks cannot restart an active break.
    time += 1000;
    assert.equal(timer.act("take-break").remainingSeconds, timings.break / 1000 - 1);
    time += timings.break - 1000;
    assert.equal(timer.snapshot().phase, "work");
    assert.equal(timer.snapshot().remainingSeconds, timings.work / 1000);
  });

  test(`${name}: snooze hides reminder and resets emotion on return`, () => {
    let time = timings.work;
    const timer = createTimer(timings, () => time);
    time += timings.work;
    timer.snapshot();
    time += timings.angry;
    assert.equal(timer.snapshot().emotion, "angry");
    assert.equal(timer.act("snooze").phase, "snooze");
    time += timings.snooze - 1;
    assert.equal(timer.snapshot().phase, "snooze");
    time++;
    assert.equal(timer.snapshot().phase, "reminder");
    assert.equal(timer.snapshot().emotion, "happy");
    assert.equal(timer.snapshot().appearance, 2);
  });
}

test("late timer callbacks present a fresh reminder; premature actions do nothing", () => {
  let time = 0;
  const timer = createTimer(TEST_TIMINGS, () => time);
  assert.equal(timer.act("take-break").phase, "work");
  time = 86400000;
  assert.equal(timer.snapshot().emotion, "happy");
  assert.equal(timer.act("unknown").phase, "reminder");
});

test("sleep-length gaps preserve paused work and recover overdue snooze and break safely", () => {
  let time = 0;
  const timer = createTimer(NORMAL_TIMINGS, () => time);
  time = 1000;
  timer.control("pause");
  time += 86400000;
  assert.equal(timer.snapshot().remainingSeconds, 3599);
  timer.control("resume");
  time += 3600000;
  assert.equal(timer.snapshot().emotion, "happy", "wake after work presents a fresh reminder");
  timer.act("snooze"); time += 86400000;
  assert.equal(timer.snapshot().phase, "reminder");
  assert.equal(timer.snapshot().emotion, "happy", "overdue snooze cannot skip straight to angry");
  timer.act("take-break"); time += 86400000;
  assert.equal(timer.snapshot().phase, "work");
  assert.equal(timer.snapshot().remainingSeconds, 3600, "wake after break starts exactly one fresh work session");
});
