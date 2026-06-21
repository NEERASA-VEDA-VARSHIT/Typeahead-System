import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/suggest": "http://localhost:3001",
      "/search": "http://localhost:3001",
      "/trending": "http://localhost:3001",
      "/metrics": "http://localhost:3001",
      "/cache": "http://localhost:3001",
      "/health": "http://localhost:3001",
    },
  },
});
