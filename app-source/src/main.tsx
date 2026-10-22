import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

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
