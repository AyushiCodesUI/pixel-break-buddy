const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("applicationSettings", {
  previewSound: (emotion, volume) => ipcRenderer.invoke("application:preview-sound", emotion, volume),
  get: () => ipcRenderer.invoke("application:get"),
  save: preferences => ipcRenderer.invoke("application:save", preferences),
  onRuntime(callback) {
    const listener = (_event, runtime) => callback(runtime);
    ipcRenderer.on("application:runtime", listener);
    return () => ipcRenderer.removeListener("application:runtime", listener);
  },
});
