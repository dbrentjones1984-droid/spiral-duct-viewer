import { Component, StrictMode, type ReactNode } from "react";
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

/** Last-resort screen if the app itself crashes: a readable message instead of a blank page. */
class RootBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const reload = (reset: boolean) =>
      (window as unknown as { __sdvBoot?: { reload?: (r: boolean) => void } }).__sdvBoot?.reload?.(reset) ?? location.reload();
    return (
      <main className="grid h-svh place-items-center bg-paper px-6 text-center text-ink">
        <div className="max-w-xs">
          <p className="font-display text-2xl text-accent">Something went wrong</p>
          <p className="mt-2 text-sm text-muted">The catalog hit an error on this device.</p>
          <button type="button" onClick={() => reload(false)} className="mt-4 h-11 w-full rounded-card bg-accent text-sm font-medium text-accent-ink">
            Reload
          </button>
          <button type="button" onClick={() => reload(true)} className="mt-2 h-11 w-full rounded-card border border-line bg-surface text-sm font-medium">
            Reset app &amp; reload
          </button>
          <p className="mt-3 text-xs break-words text-muted">{this.state.error}</p>
        </div>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
);

// Splash (static markup in index.html): fade out once the app has painted, but keep it up at least ~1.5 s
// from page start so it never just flashes. Every wait is capped, so it can never stay up forever.
type Boot = { mounted: boolean; failed: boolean };
const boot = (window as unknown as { __sdvBoot?: Boot }).__sdvBoot;
if (boot) boot.mounted = true;
try {
  sessionStorage.removeItem("sdv-retried");
} catch {
  /* storage blocked in some in-app viewers */
}
if (/[?&]r=\d+/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);

const MIN_SPLASH_MS = 1500;
const MAX_WAIT_MS = 3000;
const capped = <T,>(p: Promise<T>) => Promise.race([p, new Promise((r) => setTimeout(r, MAX_WAIT_MS))]);
const painted = new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const fonts = document.fonts?.ready ?? Promise.resolve();
let hidden = false;
function hideSplash() {
  if (hidden) return;
  hidden = true;
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.remove("splash-error");
  splash.classList.add("splash-hide");
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 1000);
}
void Promise.all([capped(painted), capped(fonts)]).then(() => {
  setTimeout(hideSplash, Math.max(0, MIN_SPLASH_MS - performance.now()));
});
// Hard fallback: the app has mounted, so the splash goes after 6 s no matter what.
setTimeout(hideSplash, Math.max(0, 6000 - performance.now()));

registerServiceWorker();
