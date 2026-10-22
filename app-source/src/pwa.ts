/* Spiral Duct Viewer · PWA glue (mirrors the NWCC Campus Map pwa.js): service worker registration,
   install prompt (Android/desktop beforeinstallprompt + iPhone "Add to Home Screen" hint), update toast. */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export type InstallState = { canPrompt: boolean; ios: boolean; standalone: boolean; installed: boolean };

const standalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let deferredPrompt: InstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, ios: isIOS, standalone, installed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<InstallState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const installStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

// ---------- toast ----------
let toastTimer = 0;
export function toast(msg: string, action?: { label: string; run: () => void }, ms = 4000) {
  let el = document.getElementById("pwa-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "pwa-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.onclick = () => {
      el!.classList.remove("show");
      action.run();
    };
    el.appendChild(b);
  }
  el.classList.add("show");
  clearTimeout(toastTimer);
  if (ms) toastTimer = window.setTimeout(() => el!.classList.remove("show"), ms);
}

// ---------- install ----------
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as InstallPromptEvent;
  if (!standalone) set({ canPrompt: true });
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  set({ canPrompt: false, installed: true });
  toast("Spiral Duct Viewer installed. Open it from your home screen.");
});

export async function promptInstall() {
  if (deferredPrompt) {
    const p = deferredPrompt;
    deferredPrompt = null;
    await p.prompt();
    try {
      await p.userChoice;
    } catch {
      /* ignore */
    }
    set({ canPrompt: false });
  } else if (isIOS) {
    toast("In Safari: tap Share (□↑), then “Add to Home Screen”.", undefined, 7000);
  }
}

// ---------- service worker ----------
/** Register after the splash is gone and the page has loaded, so precaching never slows the first paint. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!secure) return;
  const go = () => {
    const wait = () => (document.getElementById("splash") ? setTimeout(wait, 250) : setTimeout(register, 1000));
    wait();
  };
  const register = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "activated" && !hadController) toast("Ready to work offline.", undefined, 3000);
          });
        });
        // Look for a new version whenever the app comes back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch((err) => console.warn("Service worker registration failed", err));
    // A new version took over by itself (self-healing SW). Page loads are network-first, so this page is
    // normally current already; offer a refresh, and do it automatically if the app is in the background.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      if (document.visibilityState === "hidden") location.reload();
      else toast("The app was updated.", { label: "Refresh", run: () => location.reload() }, 8000);
    });
  };
  const hadController = !!navigator.serviceWorker.controller;
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
