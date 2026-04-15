import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        // Local dev: use the Workers API (wrangler dev).
        // If you want to use the legacy Express server instead, change back to :3000.
        // Local backend dev server.
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
});
