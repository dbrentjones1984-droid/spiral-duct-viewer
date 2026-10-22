# Spiral Systems – Spiral Duct Viewer

Product catalog + 3D double-wall spiral duct viewer (shell/liner finishes, AccuFlange info, catalogue sheets).

**Live:** https://dbrentjones1984-droid.github.io/spiral-duct-viewer/

## Layout
- Repo root = the built static site served by GitHub Pages (branch `main`, folder `/`).
- `app-source/` = the React + Vite + three.js source.

## PWA
Installable app (manifest.webmanifest, sw.js, icons/). `sw.js` is generated at build time from `app-source/sw-template.js` with a precache list and a content-hash version, so every rebuild ships a new cache version and the app shows a "Reload" toast for updates.

## Rebuild
```
cd app-source
npm install
npm run build          # outputs app-source/dist with base /spiral-duct-viewer/
# then copy app-source/dist/* to the repo root (replace old assets/), commit, push
```
