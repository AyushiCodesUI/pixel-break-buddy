const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mascotSettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  save: preferences => ipcRenderer.invoke("settings:save", preferences),
});
