const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("buddy", {
  onState(callback) {
    ipcRenderer.on("buddy:state", (_event, state) => callback(state));
  },
  onPreferences(callback) {
    ipcRenderer.on("buddy:preferences", (_event, preferences) => callback(preferences));
  },
  onAudioPreferences(callback) {
    ipcRenderer.on("buddy:audio-preferences", (_event, value) => callback(value));
  },
  onPlayAudio(callback) {
    ipcRenderer.on("buddy:play-audio", (_event, value) => callback(value));
  },
  onStopAudio(callback) {
    ipcRenderer.on("buddy:stop-audio", () => callback());
  },
  emotionSound: request => ipcRenderer.send("buddy:emotion-sound", request),
  ready: () => ipcRenderer.send("buddy:ready"),
  takeBreak: () => ipcRenderer.send("buddy:action", "take-break"),
  snooze: () => ipcRenderer.send("buddy:action", "snooze"),
  setInteractive: (interactive) => ipcRenderer.send("buddy:interactive", interactive),
});
