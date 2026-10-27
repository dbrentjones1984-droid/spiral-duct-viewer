import { useEffect, useState } from "react";

/**
 * Tiny hash router (works on GitHub Pages with no server config; the phone's back button walks the history).
 *   ""                         home (tabs)
 *   "#/single-wall/round"      Single Wall Duct · Round catalog sheets
 *   "#/single-wall/round/3d"   same, with the 3D model open on top
 *   "#/single-wall/oval"       Single Wall Duct · Oval gauge charts
 *   "#/single-wall/oval/3d"    same, with the oval 3D model open on top
 *   "#/single-wall-fittings/round"            Single Wall Fittings · Round sheets (View 3D Model -> the model list)
 *   "#/single-wall-fittings/round/3d"         list of fitting 3D models
 *   "#/single-wall-fittings/round/3d/e90"     same, with the gored 90° elbow (E90) 3D model open on top
 *   "#/single-wall-fittings/round/3d/ds90"    same, with the die-stamped 90° elbow 3D model open on top
 *   "#/single-wall-fittings/round/3d/me90"    same, with the mitered 90° elbow (ME90 / MEV90) 3D model open on top
 *   "#/single-wall-fittings/round/3d/bt90"    same, with the 90° bullhead tee (BT90 / BTV90) 3D model open on top
 *   "#/single-wall-fittings/round/3d/tee"     same, with the tees & crosses 3D model open on top (T90 shown);
 *   "#/single-wall-fittings/round/3d/tee?type=rt90"   ... opened on that type (t90, rt90, c180 or rc180)
 *   "#/single-wall-fittings/round/3d/ctee"    same, with the conical tees & crosses 3D model open on top (CT90 shown);
 *   "#/single-wall-fittings/round/3d/ctee?type=rct90" ... opened on that type (ct90, rct90, cc180 or rcc180)
 */
export type Route =
  | { page: "home" }
  | { page: "sw-round"; model3d: boolean }
  | { page: "sw-oval"; model3d: boolean }
  | { page: "swf-round" }
  | { page: "swf-models"; model3d: "e90" | "ds90" | "me90" | "bt90" | "tee" | "ctee" | null; teeType?: TeeType; cteeType?: CteeType };

/** Tees & Crosses sheet types (one model, picked in the viewer). */
export const TEE_TYPES = ["t90", "rt90", "c180", "rc180"] as const;
export type TeeType = (typeof TEE_TYPES)[number];
/** Conical Tees and Conical Crosses sheet types (one model, picked in the viewer). */
export const CTEE_TYPES = ["ct90", "rct90", "cc180", "rcc180"] as const;
export type CteeType = (typeof CTEE_TYPES)[number];

export const SW_ROUND_HASH = "#/single-wall/round";
export const SW_ROUND_3D_HASH = "#/single-wall/round/3d";
export const SW_OVAL_HASH = "#/single-wall/oval";
export const SW_OVAL_3D_HASH = "#/single-wall/oval/3d";
export const SWF_ROUND_HASH = "#/single-wall-fittings/round";
export const SWF_MODELS_HASH = "#/single-wall-fittings/round/3d";
export const SWF_E90_3D_HASH = "#/single-wall-fittings/round/3d/e90";
export const SWF_DS90_3D_HASH = "#/single-wall-fittings/round/3d/ds90";
export const SWF_ME90_3D_HASH = "#/single-wall-fittings/round/3d/me90";
export const SWF_BT90_3D_HASH = "#/single-wall-fittings/round/3d/bt90";
export const SWF_TEE_3D_HASH = "#/single-wall-fittings/round/3d/tee";
/** Deep link to one tee/cross type (T90 is the default, so it gets the plain link). */
export const teeHash = (t: TeeType) => (t === "t90" ? SWF_TEE_3D_HASH : `${SWF_TEE_3D_HASH}?type=${t}`);
export const SWF_CTEE_3D_HASH = "#/single-wall-fittings/round/3d/ctee";
/** Deep link to one conical tee/cross type (CT90 is the default, so it gets the plain link). */
export const cteeHash = (t: CteeType) => (t === "ct90" ? SWF_CTEE_3D_HASH : `${SWF_CTEE_3D_HASH}?type=${t}`);

function parse(hash: string): Route {
  const h = hash.replace(/\/+$/, "");
  if (h === SW_ROUND_3D_HASH) return { page: "sw-round", model3d: true };
  if (h === SW_ROUND_HASH) return { page: "sw-round", model3d: false };
  if (h === SW_OVAL_3D_HASH) return { page: "sw-oval", model3d: true };
  if (h === SW_OVAL_HASH) return { page: "sw-oval", model3d: false };
  if (h === SWF_E90_3D_HASH) return { page: "swf-models", model3d: "e90" };
  if (h === SWF_DS90_3D_HASH) return { page: "swf-models", model3d: "ds90" };
  if (h === SWF_ME90_3D_HASH) return { page: "swf-models", model3d: "me90" };
  if (h === SWF_BT90_3D_HASH) return { page: "swf-models", model3d: "bt90" };
  if (h === SWF_TEE_3D_HASH || h.startsWith(`${SWF_TEE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_TEE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "tee", teeType: TEE_TYPES.find((x) => x === t) ?? "t90" };
  }
  if (h === SWF_CTEE_3D_HASH || h.startsWith(`${SWF_CTEE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_CTEE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "ctee", cteeType: CTEE_TYPES.find((x) => x === t) ?? "ct90" };
  }
  if (h === SWF_MODELS_HASH) return { page: "swf-models", model3d: null };
  if (h === SWF_ROUND_HASH) return { page: "swf-round" };
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
