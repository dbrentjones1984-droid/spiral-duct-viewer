import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Writes dist/sw.js from sw-template.js with a precache list of the built files and a content-hash VERSION. */
function serviceWorkerPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "sdv:service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push(relative(outDir, full).split(sep).join("/"));
        }
      };
      walk(outDir);
      // iOS launch images are only read when adding to the home screen; no need to precache them.
      const precache = files.filter((f) => f !== "sw.js" && !f.startsWith("icons/startup/") && f !== ".nojekyll").sort();
      const hash = createHash("sha256");
      for (const f of precache) hash.update(f).update(readFileSync(join(outDir, f)));
      const template = readFileSync("sw-template.js", "utf8");
      const sw = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 10))
        .replace("__PRECACHE__", JSON.stringify(["./", ...precache.map(encodeURI)], null, 2));
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}

// Served from https://dbrentjones1984-droid.github.io/spiral-duct-viewer/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/spiral-duct-viewer/",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [tailwindcss(), react(), serviceWorkerPlugin()],
  build: { outDir: "dist", chunkSizeWarningLimit: 2000 },
});
