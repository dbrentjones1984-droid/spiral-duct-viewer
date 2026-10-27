import { useEffect, useState } from "react";

/**
 * Tiny hash router (works on GitHub Pages with no server config; the phone's back button walks the history).
 *   ""                         home (tabs)
 *   "#/single-wall/round"      Single Wall Duct · Round catalog sheets
 *   "#/single-wall/round/3d"   same, with the 3D model open on top
 *   "#/single-wall/oval"       Single Wall Duct · Oval gauge charts
 *   "#/single-wall/oval/3d"    same, with the oval 3D model open on top
 *   "#/single-wall-fittings/round/3d"         Single Wall Fittings · Round: list of fitting 3D models
 *   "#/single-wall-fittings/round/3d/e90"     same, with the gored 90° elbow (E90) 3D model open on top
 */
export type Route =
  | { page: "home" }
  | { page: "sw-round"; model3d: boolean }
  | { page: "sw-oval"; model3d: boolean }
  | { page: "swf-models"; model3d: "e90" | null };

export const SW_ROUND_HASH = "#/single-wall/round";
export const SW_ROUND_3D_HASH = "#/single-wall/round/3d";
export const SW_OVAL_HASH = "#/single-wall/oval";
export const SW_OVAL_3D_HASH = "#/single-wall/oval/3d";
export const SWF_MODELS_HASH = "#/single-wall-fittings/round/3d";
export const SWF_E90_3D_HASH = "#/single-wall-fittings/round/3d/e90";

function parse(hash: string): Route {
  const h = hash.replace(/\/+$/, "");
  if (h === SW_ROUND_3D_HASH) return { page: "sw-round", model3d: true };
  if (h === SW_ROUND_HASH) return { page: "sw-round", model3d: false };
  if (h === SW_OVAL_3D_HASH) return { page: "sw-oval", model3d: true };
  if (h === SW_OVAL_HASH) return { page: "sw-oval", model3d: false };
  if (h === SWF_E90_3D_HASH) return { page: "swf-models", model3d: "e90" };
  if (h === SWF_MODELS_HASH) return { page: "swf-models", model3d: null };
  return { page: "home" };
}

// How many in-app steps we have pushed, so Back/Close can use history.back() (keeps the phone's back stack
// tidy) and fall back to replacing the hash when the page was opened directly from a link.
let pushed = 0;

export function navigate(hash: string) {
  pushed++;
  location.hash = hash;
}

export function goBack(fallbackHash: string) {
  if (pushed > 0) {
    pushed--;
    history.back();
  } else {
    history.replaceState(null, "", location.pathname + location.search + fallbackHash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);
  return route;
}
