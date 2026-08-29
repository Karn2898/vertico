import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "..", "src"),
    },
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },
  build: {
    outDir: path.resolve(__dirname, "..", "apps/api/apps/ide-extension/webview/dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/index[extname]",
      },
    },
  },
});
