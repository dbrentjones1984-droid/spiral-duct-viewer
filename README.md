# Spiral Systems – Spiral Duct Viewer

Product catalog + 3D double-wall spiral duct viewer (shell/liner finishes, AccuFlange info, catalogue sheets).

**Live:** https://dbrentjones1984-droid.github.io/spiral-duct-viewer/

## Layout
- Repo root = the built static site served by GitHub Pages (branch `main`, folder `/`).
- `app-source/` = the React + Vite + three.js source.

## PWA
Installable app (manifest.webmanifest, sw.js, icons/). `sw.js` is generated at build time from `app-source/sw-template.js` with a precache list and a content-hash version, so every rebuild ships a new cache version. Page loads are network-first and a new service worker takes over by itself and clears old `sdv-` caches. `index.html` has a boot guard: if the app's files can't load it retries once with a cache-busting reload, then shows Reload / Reset buttons instead of a stuck splash.

## Rebuild
```
cd app-source
npm install
npm run build          # outputs app-source/dist with base /spiral-duct-viewer/
# then copy app-source/dist/* over the repo root WITHOUT deleting old files in assets/
# (phones/in-app browsers may still have an older index.html cached for a few minutes and need the old hashed files), commit, push
```
