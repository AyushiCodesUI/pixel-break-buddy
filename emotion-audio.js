(function (root) {
  // Original, locally synthesized cues. No samples or network requests.
  const CUES = Object.freeze({
    happy: [{ at: 0, duration: 0.22, frequency: 523.25 }, { at: 0.24, duration: 0.28, frequency: 659.25 }],
    annoyed: [{ at: 0, duration: 0.12, frequency: 440 }, { at: 0.2, duration: 0.14, frequency: 392 }],
    angry: [{ at: 0, duration: 0.56, frequency: 196, endFrequency: 164.81, buzz: true }],
  });
  function createGate() {
    let appearance;
    const played = new Set();
    return {
      accept(state, request, preferences, visible) {
        if (!request || state.paused || !Object.hasOwn(CUES, request.emotion) || state.phase !== "reminder"
          || request.appearance !== state.appearance || request.emotion !== state.emotion || !visible) return false;
        if (appearance !== state.appearance) { appearance = state.appearance; played.clear(); }
        if (played.has(request.emotion)) return false;
        // Muted transitions are consumed too, so enabling sounds/reloading
        // later cannot replay an expression that has already settled.
        played.add(request.emotion);
        return preferences.sounds && preferences.soundVolume > 0;
      },
    };
  }
  function createPlayer(createContext = () => new root.AudioContext()) {
    let context, master, generation = 0;
    let preferences = { sounds: false, soundVolume: 25 };
    const voices = new Set();
    function stop() {
      generation++;
      for (const voice of voices) {
        try { voice.oscillator.stop(); } catch {}
        voice.oscillator.disconnect(); voice.envelope.disconnect();
      }
      voices.clear();
    }
    function configure(value) {
      const previous = preferences;
      preferences = { sounds: value.sounds === true,
        soundVolume: Number.isFinite(value.soundVolume) ? Math.min(100, Math.max(0, value.soundVolume)) : 25 };
      if (!preferences.sounds || preferences.soundVolume === 0 || previous.soundVolume !== preferences.soundVolume) stop();
    }
    async function play(emotion, volume = preferences.soundVolume) {
      stop();
      if (!Object.hasOwn(CUES, emotion) || !preferences.sounds || !Number.isFinite(volume) || volume <= 0) return false;
      const token = generation;
      try {
        if (!context) {
          context = createContext();
          master = context.createGain(); master.connect(context.destination);
        }
        if (context.state === "suspended") await context.resume();
        if (token !== generation || !preferences.sounds || context.state !== "running") return false;
        const start = context.currentTime + 0.01;
        // Conservative headroom even at 100%; the default is a gentle 25%.
        master.gain.setValueAtTime(Math.min(100, volume) / 100 * 0.12, context.currentTime);
        for (const note of CUES[emotion]) {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          const voice = { oscillator, envelope };
          voices.add(voice);
          const at = start + note.at, end = at + note.duration;
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(note.frequency, at);
          if (note.endFrequency) oscillator.frequency.linearRampToValueAtTime(note.endFrequency, end);
          envelope.gain.setValueAtTime(0, at);
          envelope.gain.linearRampToValueAtTime(0.6, at + 0.015);
          if (note.buzz) {
            for (let beat = 1; beat <= 7; beat++) {
              const time = at + beat * 0.06;
              envelope.gain.linearRampToValueAtTime(beat % 2 ? 0.32 : 0.6, time);
            }
          }
          envelope.gain.setValueAtTime(note.buzz ? 0.32 : 0.6, end - 0.07);
          envelope.gain.linearRampToValueAtTime(0, end);
          oscillator.connect(envelope); envelope.connect(master);
          oscillator.onended = () => {
            oscillator.disconnect(); envelope.disconnect(); voices.delete(voice);
          };
          oscillator.start(at); oscillator.stop(end);
        }
        return true;
      } catch (error) {
        stop();
        if (root.console) root.console.warn("[emotion audio] Playback unavailable:", error.message);
        return false;
      }
    }
    return { configure, play, stop };
  }
  const api = { CUES, createPlayer, createGate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EmotionAudio = api;
})(globalThis);
