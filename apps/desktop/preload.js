// Preload: expose a minimal safe bridge to the renderer.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("vertico", {
  version: "0.1.0",
  platform: process.platform,
});
