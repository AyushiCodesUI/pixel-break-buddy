window.addEventListener("error", (event) => console.error("Renderer error:", event.message));
window.addEventListener("unhandledrejection", (event) => console.error("Renderer rejection:", event.reason));
console.log("Renderer starting; bridge available:", typeof window.buddy?.ready);

const soundPlayer = window.EmotionAudio.createPlayer();
let soundDismissed = false;
window.buddy.onAudioPreferences(value => soundPlayer.configure(value));
window.buddy.onStopAudio(() => soundPlayer.stop());
window.buddy.onPlayAudio(value => {
  if (!value.preview && (soundDismissed || buddyElement.hidden || walking || emotionTransition
    || currentState?.phase !== "reminder" || currentState.emotion !== value.emotion)) return;
  void soundPlayer.play(value.emotion, value.volume);
});
function requestEmotionSound() {
  if (!soundDismissed && !walking && !emotionTransition && !buddyElement.hidden
    && currentState?.phase === "reminder" && currentState.emotion === emotion) {
    window.buddy.emotionSound({ appearance: currentState.appearance, emotion });
  }
}

const art = window.MascotArt;
let preferences = { ...art.DEFAULTS };
const mascot = document.getElementById("mascot");
const mascotImage = document.getElementById("mascot-image");
const walkingSprite = document.getElementById("walking-sprite");
mascotImage.addEventListener("error", () => {
  console.error("Could not load mascot image:", mascotImage.getAttribute("src"));
});

let emotion = "happy";
let walking = false;
let emotionTransition = null;
let emotionFrame;
function drawExpression() {
  const dimensions = window.MascotImages.draw(mascot, mascotImage, preferences.size, emotion, window.devicePixelRatio || 1);
  walker.style.width = `${dimensions.width}px`;
  walker.style.height = `${dimensions.height}px`;
  bubble.style.bottom = `${dimensions.height + 28}px`;
  // The supplied sprite has a shadow baseline at y=449/512; the happy
  // PNG baseline is y=1068/1199. Correct padding, without scaling either.
  const groundOffset = (dimensions.height - dimensions.width * 0.9) + dimensions.width * 0.9 * 449 / 512 - dimensions.width * 1068 / 1312;
  const dpr = window.devicePixelRatio || 1;
  walkingSprite.style.bottom = `${Math.round(groundOffset * dpr) / dpr}px`;
  mascotImage.hidden = false;
  const anchor = window.MascotImages.ALIGNMENT.happy;
  mascot.style.transformOrigin = `${dimensions.width * anchor.center / 1312}px ${dimensions.width * anchor.ground / 1312}px`;
  walkingSprite.hidden = !walking;
  mascot.setAttribute("aria-label", `${emotion} pixel art buddy; toggle reminder`);
}

const buddyElement = document.getElementById("buddy");
const bubble = document.getElementById("bubble");
const walker = document.getElementById("walker");
const message = document.getElementById("message");
const detail = document.getElementById("detail");
const countdown = document.getElementById("countdown");
const actions = document.getElementById("actions");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentState;
let lastAppearance = 0;
let lastState = "";
let bubbleOpen = true;
let textKey = "";
let animationFrame, settleTimeout, typeInterval;
let walkStarted = null;
let entranceDistance = 0;

function paintEntrance(timestamp) {
  if (!walking) return;
  if (walkStarted === null) walkStarted = timestamp;
  const sample = window.BuddyEntrance.sample(timestamp - walkStarted, entranceDistance, window.devicePixelRatio || 1);
  walker.style.transform = `translateX(${sample.x}px)`;
  walkingSprite.style.backgroundPosition = `${sample.frame * 20}% 0`;
  if (sample.stopped) {
    // Keep the planted walking pose while dissolving to the original happy
    // pose. Both remain on the same ground; the final idle image is unscaled.
    mascotImage.hidden = false;
    walker.classList.add("settling");
    settleTimeout = setTimeout(finishWalk, window.BuddyEntrance.SETTLE);
    animationFrame = undefined;
  } else animationFrame = requestAnimationFrame(paintEntrance);
}

function cancelAnimations() {
  finishEmotion(false);
  cancelAnimationFrame(animationFrame); clearTimeout(settleTimeout);
  clearInterval(typeInterval);
  animationFrame = undefined;
  walking = false;
  walkingSprite.hidden = true;
  mascotImage.hidden = false;
  walker.classList.remove("walking");
  walker.classList.remove("settling");
  walker.style.transform = "translateX(0px)";
}
function updateBubble() {
  const wasHidden = bubble.hidden;
  bubble.hidden = walking || !bubbleOpen || buddyElement.hidden;
  mascot.setAttribute("aria-expanded", String(!bubble.hidden));
  if (bubble.hidden) { clearInterval(typeInterval); textKey = ""; }
  else {
    if (wasHidden && !motion.matches) {
      bubble.classList.remove("revealing");
      void bubble.offsetWidth;
      bubble.classList.add("revealing");
    }
    renderText();
  }
}
function renderText() {
  if (!currentState || bubble.hidden || emotionTransition) return;
  const onBreak = currentState.phase === "break";
  const messages = {
    happy: ["Time for a little break!", "Let's stretch and rest your eyes."],
    annoyed: ["Still working?", "I've been waiting. Your break is overdue!"],
    angry: ["Break time. Seriously!", "Your eyes and shoulders need a rest."],
  };
  const personalityMessages = {
    playful: {
      happy: ["Quest: take a break!", "Stretch those paws. Water break, go!"],
      annoyed: ["Your break is waiting!", "Even pixel heroes need to recharge."],
      angry: ["Pause the quest!", "Time to rest those hardworking eyes."],
    },
    sassy: {
      happy: ["Break time, superstar.", "The screen will survive five minutes."],
      annoyed: ["Still here? Really?", "Your shoulders called. They want a break."],
      angry: ["Step away, legend.", "Even your pixels need a breather."],
    },
  };
  const selectedMessages = personalityMessages[preferences.personality] || messages;
  const [title, body] = onBreak ? ["Enjoy your break!", "Stretch, get some water, and rest your eyes."] : selectedMessages[emotion];
  const key = `${currentState.phase}:${emotion}:${preferences.personality}`;
  if (key === textKey) return;
  textKey = key;
  clearInterval(typeInterval);
  // The full title is accessible immediately; only its visual copy types out.
  message.setAttribute("aria-label", title);
  message.textContent = title;
  detail.textContent = body;
  if (motion.matches) return;
  let letters = 0;
  message.textContent = "";
  typeInterval = setInterval(() => {
    message.textContent = title.slice(0, ++letters);
    if (letters >= title.length) clearInterval(typeInterval);
  }, 28);
}
function finishEmotion(notify = true, target = emotionTransition?.to || emotion) {
  cancelAnimationFrame(emotionFrame);
  emotionFrame = undefined;
  emotion = target;
  emotionTransition = null;
  mascot.classList.remove("transitioning");
  mascot.style.transform = "";
  buddyElement.setAttribute("data-emotion", emotion);
  drawExpression();
  if (notify) { updateBubble(); requestEmotionSound(); }
}
function paintEmotion(timestamp) {
  if (!emotionTransition) return;
  if (emotionTransition.started === null) emotionTransition.started = timestamp;
  const pose = window.BuddyEmotions.sample(emotionTransition.to, timestamp - emotionTransition.started, emotionTransition.initialY);
  const dpr = window.devicePixelRatio || 1;
  const snap = value => Math.round(value * dpr) / dpr;
  mascot.style.transform = `translate(${snap(pose.x)}px, ${snap(pose.y)}px) scaleY(${pose.scaleY})`;
  if (pose.swap && !emotionTransition.swapped) {
    emotionTransition.swapped = true;
    emotion = emotionTransition.to;
    drawExpression();
  }
  if (pose.done) finishEmotion();
  else emotionFrame = requestAnimationFrame(paintEmotion);
}
function changeEmotion(target) {
  if (emotionTransition?.to === target) return;
  // Retain the currently visible expression when interrupted; never flash an
  // obsolete target PNG before starting the latest requested expression.
  finishEmotion(false, emotion);
  if (emotion === target) return;
  if (motion.matches || walking || currentState.phase !== "reminder") {
    emotion = target; finishEmotion(); return;
  }
  const matrix = getComputedStyle(mascot).transform.match(/^matrix\((.+)\)$/);
  const initialY = matrix ? Number(matrix[1].split(",")[5]) : 0;
  emotionTransition = { to: target, started: null, initialY, swapped: false };
  mascot.classList.add("transitioning");
  mascot.style.transform = `translate(0px, ${initialY}px)`;
  drawExpression();
  emotionFrame = requestAnimationFrame(paintEmotion);
}

function finishWalk() {
  cancelAnimationFrame(animationFrame); clearTimeout(settleTimeout);
  animationFrame = undefined;
  walking = false;
  walker.classList.remove("settling");
  walker.classList.remove("walking");
  walker.style.transform = "translateX(0px)";
  drawExpression(); updateBubble(); requestEmotionSound();
}
function startWalk() {
  cancelAnimations();
  bubbleOpen = true;
  walking = !motion.matches;
  updateBubble();
  if (!walking) { finishWalk(); return; }
  drawExpression();
  // Measure once at rest. Movement stays entirely in this renderer window.
  const bounds = walker.getBoundingClientRect();
  entranceDistance = window.innerWidth - bounds.left + (currentState.entranceInset || 0) + 1 / (window.devicePixelRatio || 1);
  walker.classList.add("walking");
  walker.style.transform = `translateX(${entranceDistance}px)`;
  walkingSprite.style.backgroundPosition = "0% 0";
  walkStarted = null;
  animationFrame = requestAnimationFrame(paintEntrance);
}
function toggleBubble() {
  if (walking) return;
  bubbleOpen = !bubbleOpen; updateBubble();
}
mascot.addEventListener("click", toggleBubble);
mascot.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleBubble(); }
});
function dismissSound(action) {
  soundDismissed = true; soundPlayer.stop(); action();
}
document.getElementById("take-break").addEventListener("click", () => dismissSound(() => window.buddy.takeBreak()));
document.getElementById("snooze").addEventListener("click", () => dismissSound(() => window.buddy.snooze()));

// macOS forwards mouse movement even while empty window space is click-through.
let lastInteractive = false;
window.addEventListener("mousemove", event => {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const interactive = !buddyElement.hidden && Boolean(target?.closest("#mascot, #bubble"));
  if (interactive !== lastInteractive) {
    lastInteractive = interactive;
    window.buddy.setInteractive(interactive);
  }
});
window.addEventListener("mouseleave", () => {
  lastInteractive = false; window.buddy.setInteractive(false);
});
motion.addEventListener("change", () => {
  cancelAnimations(); textKey = "";
  if (currentState) emotion = currentState.emotion;
  if (!buddyElement.hidden) finishWalk();
});

window.buddy.onState(state => {
  currentState = state;
  const key = `${state.phase}:${state.emotion}`;
  if (key !== lastState) { console.log("Reminder state received:", JSON.stringify(state)); lastState = key; }
  const wasHidden = buddyElement.hidden;
  buddyElement.hidden = state.phase !== "reminder" && state.phase !== "break";
  document.getElementById("mode").hidden = !state.testMode && !state.preview;
  document.getElementById("mode").textContent = state.preview ? "Test reminder · end via menu bar" : "Test mode";
  if (buddyElement.hidden) {
    soundPlayer.stop();
    cancelAnimations(); textKey = ""; lastInteractive = false;
    window.buddy.setInteractive(false);
    return;
  }
  if (state.phase !== "reminder" && emotionTransition) {
    finishEmotion(false, state.emotion);
  }
  const changedEmotion = (emotionTransition?.to || emotion) !== state.emotion;
  if (state.appearance !== lastAppearance || wasHidden) {
    finishEmotion(false);
    emotion = state.emotion;
    buddyElement.setAttribute("data-emotion", emotion);
    soundDismissed = false;
    lastAppearance = state.appearance;
    if (state.phase === "break") { bubbleOpen = true; finishWalk(); }
    else startWalk();
  } else if (changedEmotion) changeEmotion(state.emotion);
  const onBreak = state.phase === "break";
  actions.hidden = onBreak;
  countdown.hidden = !onBreak;
  if (onBreak) {
    const minutes = Math.floor(state.remainingSeconds / 60);
    const seconds = String(state.remainingSeconds % 60).padStart(2, "0");
    countdown.textContent = `${minutes}:${seconds}`;
  }
  updateBubble();
});
window.buddy.onPreferences(value => {
  preferences = art.normalize(value);
  buddyElement.setAttribute("data-personality", preferences.personality);
  textKey = "";
  drawExpression();
  updateBubble();
});
window.buddy.ready();
console.log("Renderer ready message sent");
