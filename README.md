# Spiral Systems – Spiral Duct Viewer

Product catalog + 3D double-wall spiral duct viewer (shell/liner finishes, AccuFlange info, catalogue sheets).

**Live:** https://dbrentjones1984-droid.github.io/spiral-duct-viewer/

## Layout
- Repo root = the built static site served by GitHub Pages (branch `main`, folder `/`).
- `app-source/` = the React + Vite + three.js source.

## Rebuild
```
cd app-source
npm install
npm run build          # outputs app-source/dist with base /spiral-duct-viewer/
# then copy app-source/dist/* to the repo root (replace old assets/), commit, push
```
