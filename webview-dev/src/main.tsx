import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: (msg: unknown) => void };
  }
}

// Provide a simple mock for `acquireVsCodeApi` when running in a browser
if (!window.acquireVsCodeApi) {
  window.acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) => console.log("vscode.postMessage:", msg),
  });
}

import App from "./App";

const root = document.getElementById("root")!;
createRoot(root).render(React.createElement(App));
