import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ["**/*.wasm"],
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: [
      // Force Vite to optimize these CommonJS dependencies
      "vscode-textmate",
      "vscode-oniguruma",
      "@vscode/vscode-languagedetection",
      // Include the new separate monaco-vscode-api service override packages
      "@codingame/monaco-vscode-api",
      "@codingame/monaco-vscode-configuration-service-override",
      "@codingame/monaco-vscode-keybindings-service-override",
      "@codingame/monaco-vscode-theme-service-override",
      "@codingame/monaco-vscode-textmate-service-override",
      "@codingame/monaco-vscode-languages-service-override",
      "@codingame/monaco-vscode-model-service-override",
      "@codingame/monaco-vscode-theme-defaults-default-extension",
      // Add monaco-languageclient and vscode-languageclient for proper LSP support
      "monaco-languageclient",
      "vscode-languageclient",
      "vscode-ws-jsonrpc",
    ],
    exclude: [
      // Exclude monaco-editor from optimization to avoid conflicts
      "monaco-editor",
    ],
    esbuildOptions: {
      plugins: [importMetaUrlPlugin],
    },
    // Add entries to ensure dependency scanning works properly
    entries: ["index.html", "src/main.tsx"],
    // Force dependency discovery to avoid I/O issues
    force: true,
  },
  resolve: {
    alias: {
      // Ensure vscode is resolved correctly (no longer needed with npm alias)
      // vscode: "@codingame/monaco-vscode-api",
    },
  },
  server: {
    host: true,
    port: 5173,
    watch:
      process.env.DISABLE_WATCH === "true"
        ? null
        : {
            // Use polling for file changes detection in Docker on WSL2
            usePolling: true,
            interval: 1000,
            // Disable fsevents since we're using polling
            useFsEvents: false,
            // Ignore problematic paths that might cause I/O errors
            ignored: [
              "**/node_modules/**",
              "**/.git/**",
              "**/dist/**",
              "**/build/**",
              "**/public/**", // Add public directory to ignored list to prevent I/O errors
              "**/.vite/**",
              "**/coverage/**",
              "**/.idea/**",
              "**/.vscode/**",
              "**/venv/**",
              "**/__pycache__/**",
            ],
            // Disable binary file watching
            binaryInterval: 300,
            awaitWriteFinish: {
              stabilityThreshold: 2000,
              pollInterval: 100,
            },
          },
    proxy: {
      // Executor WebSocket specific proxy for LSP
      "/executor/lsp": {
        target: process.env.VITE_EXECUTOR_URL || "http://localhost:8001",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/executor/, "/api"),
        configure: (proxy) => {
          proxy.on("error", (err, req) => {
            console.error("Executor LSP WebSocket proxy error:", err.message);
            console.error("Request URL:", req.url);
          });

          proxy.on("proxyReqWs", (proxyReq, req) => {
            console.log("Executor LSP WebSocket proxy request:", req.url);
            // Ensure WebSocket upgrade headers are preserved
            proxyReq.setHeader("Upgrade", "websocket");
            proxyReq.setHeader("Connection", "Upgrade");
          });

          proxy.on("open", () => {
            console.log("Executor LSP WebSocket opened");
          });

          proxy.on("close", () => {
            console.log("Executor LSP WebSocket closed");
          });
        },
      },
      // Executor WebSocket proxy for terminal
      "/executor/terminal": {
        target: process.env.VITE_EXECUTOR_URL || "http://localhost:8001",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/executor\/terminal/, "/api/terminal"),
      },
      // Executor HTTP API proxy
      "/executor": {
        target: process.env.VITE_EXECUTOR_URL || "http://localhost:8001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/executor/, "/api"),
      },
      // Backend HTTP/REST API proxy
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err, req) => {
            console.error("API proxy error:", err.message);
            console.error("Request URL:", req.url);
          });
        },
      },
    },
  },
});
