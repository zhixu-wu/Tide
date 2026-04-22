import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Split the three heavy vendor groups so the main bundle parses fast and
    // lazy tabs (chart, history) don't block the initial paint. (All chunks
    // still ship with the installer — this is purely about parse/eval time.)
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["monaco-editor", "@monaco-editor/react"],
          echarts: ["echarts", "echarts-for-react"],
          aggrid: ["ag-grid-community", "ag-grid-react"],
        },
      },
    },
    // Suppress the 500 KB warning: we have three intentionally-large vendor
    // chunks (monaco/echarts/ag-grid) that bloat past the default threshold.
    chunkSizeWarningLimit: 1500,
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
