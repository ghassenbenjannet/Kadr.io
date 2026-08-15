import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build sorti dans dist/public, servi statiquement par le serveur Hono
// (server/index.ts) — une seule application, un seul processus.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3737",
    },
  },
});
