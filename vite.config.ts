import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative base so the built app also works from file:// or a subfolder.
  base: "./",
  server: { port: 5273, host: "127.0.0.1" },
  build: { outDir: "dist" },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as never);
