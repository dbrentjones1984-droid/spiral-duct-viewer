import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted fonts (latin subset) so the installed app looks right offline.
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "./styles.css";
import { registerServiceWorker } from "./pwa";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Splash (static markup in index.html): fade out once the app has painted,
// but keep it up at least ~1.5 s from page start so it never just flashes.
const MIN_SPLASH_MS = 1500;
const painted = new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const fonts = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
void Promise.all([painted, fonts]).then(() => {
  const wait = Math.max(0, MIN_SPLASH_MS - performance.now());
  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (!splash) return;
    splash.classList.add("splash-hide");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), 1000);
  }, wait);
});

registerServiceWorker();
