# Spiral Systems – Spiral Duct Viewer

**Current state: interface only.** The catalog content is removed for now while the interface is reworked. The home screen has the header and logo, the PRODUCT CATALOG bar, the install button, and the four category tabs (Single Wall Duct, Single Fitting, Double Duct, Double Fitting). Tapping a tab highlights it. A drop-down menu under the tabs is planned.

Removed for now: the catalog data (product lines, sheets, item codes), the PDF sheet viewer and `catalogue.pdf`, the AccuFlange PDF and image, `double-wall.jpg`, and the 3D double-wall duct viewer (finish menus).

### Restoring the catalog
- Everything removed is in git history at commit `2dee8f9` (the last build with the catalog; source in `app-source/`, media in the repo root).
- A backup is also kept on the build box at `/workspace/spiral-duct-catalog-backup` (box path, not in this repo). It holds the removed files and a `restore-catalog.patch`. To restore, run `git apply restore-catalog.patch` in the source tree and rebuild. See `RESTORE.md` there.
- After restoring, copy the catalog media (`catalogue.pdf`, `accuflange.pdf`, `accuflange.png`) back into the site with the rebuild (they live in `app-source/public/`).

**Live:** https://dbrentjones1984-droid.github.io/spiral-duct-viewer/

## Layout
- Repo root = the built static site served by GitHub Pages (branch `main`, folder `/`).
- `app-source/` = the React + Vite source. The three.js and pdf.js dependencies are still listed in package.json for an easy restore, but the current build doesn't use them.

## PWA
Installable app (manifest.webmanifest, sw.js, icons/). `sw.js` is generated at build time from `app-source/sw-template.js` with a precache list and a content-hash version, so every rebuild ships a new cache version. Page loads are network-first and a new service worker takes over by itself and clears old `sdv-` caches. `index.html` has a boot guard: if the app's files can't load it retries once with a cache-busting reload, then shows Reload / Reset buttons instead of a stuck splash.

## Rebuild
```
cd app-source
npm install
rm -rf dist && npm run build   # clean first: Tailwind also scans a stale dist/. Outputs app-source/dist with base /spiral-duct-viewer/
# then copy app-source/dist/* over the repo root WITHOUT deleting old files in assets/
# (phones/in-app browsers may still have an older index.html cached for a few minutes and need the old hashed files), commit, push
```
