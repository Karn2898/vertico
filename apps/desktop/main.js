const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");

const WEB_UI = process.env.VERTICO_WEB_URL || "http://localhost:5173";
const API_DOCS = process.env.VERTICO_API_URL || "http://localhost:8000/docs";

function urlIsUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.destroy();
      resolve(res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function pickTarget() {
  const apiParam = "?api=" + encodeURIComponent(API_DOCS.replace(/\/docs$/, ""));
  if (await urlIsUp(WEB_UI)) return WEB_UI + apiParam;
  if (await urlIsUp(API_DOCS)) return API_DOCS;
  // Fallback to bundled static web UI (apps/desktop/web/index.html)
  const fallback = path.join(__dirname, "web", "index.html");
  if (require("fs").existsSync(fallback)) return "file://" + fallback + apiParam;
  return API_DOCS;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "Vertico",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pickTarget().then((target) => win.loadURL(target));

  // Open external links in the browser, not a new electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
