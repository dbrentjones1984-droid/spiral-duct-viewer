import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served from https://dbrentjones1984-droid.github.io/spiral-duct-viewer/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/spiral-duct-viewer/",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [tailwindcss(), react()],
  build: { outDir: "dist", chunkSizeWarningLimit: 2000 },
});
