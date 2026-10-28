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
 *   "#/single-wall-fittings/round/3d/lat"     same, with the laterals 3D model open on top (L45 shown);
 *   "#/single-wall-fittings/round/3d/lat?type=rl45"   ... opened on that type (l45, rl45, lc45 or rlc45)
 *   "#/single-wall-fittings/round/3d/tap"     same, with the straight & conical taps 3D model open on top (SST90 shown);
 *   "#/single-wall-fittings/round/3d/tap?type=st90"   ... opened on that type (sst90, ct90s, st90 or ct90)
 *   "#/single-wall-fittings/round/3d/ltap"    same, with the lateral taps 3D model open on top (LST45 shown);
 *   "#/single-wall-fittings/round/3d/ltap?type=lt45"  ... opened on that type (lst45 or lt45)
 *   "#/single-wall-fittings/round/3d/red"     same, with the reducers 3D model open on top (CR shown);
 *   "#/single-wall-fittings/round/3d/red?type=er"     ... opened on that type (cr or er)
 *   "#/single-wall-fittings/round/3d/cap"     same, with the couplings, caps & collars 3D model open on top (PC shown);
 *   "#/single-wall-fittings/round/3d/cap?type=bm"     ... opened on that type (pc, fc, ec, sc or bm)
 *   "#/single-wall-fittings/round/3d/wye"     same, with the wye & reducing wye 3D model open on top (Y45 shown);
 *   "#/single-wall-fittings/round/3d/wye?type=ry45"   ... opened on that type (y45 or ry45)
 */
export type Route =
  | { page: "home" }
  | { page: "sw-round"; model3d: boolean }
  | { page: "sw-oval"; model3d: boolean }
  | { page: "swf-round" }
  | { page: "swf-models"; model3d: "e90" | "ds90" | "me90" | "bt90" | "tee" | "ctee" | "lat" | "tap" | "ltap" | "red" | "cap" | "wye" | null; teeType?: TeeType; cteeType?: CteeType; latType?: LatType; tapType?: TapType; ltapType?: LtapType; redType?: RedType; capType?: CapType; wyeType?: WyeType };

/** Tees & Crosses sheet types (one model, picked in the viewer). */
export const TEE_TYPES = ["t90", "rt90", "c180", "rc180"] as const;
export type TeeType = (typeof TEE_TYPES)[number];
/** Conical Tees and Conical Crosses sheet types (one model, picked in the viewer). */
export const CTEE_TYPES = ["ct90", "rct90", "cc180", "rcc180"] as const;
export type CteeType = (typeof CTEE_TYPES)[number];
/** Laterals sheet types (one model, picked in the viewer). */
export const LAT_TYPES = ["l45", "rl45", "lc45", "rlc45"] as const;
export type LatType = (typeof LAT_TYPES)[number];
/**
 * Straight and Conical Taps sheet types (one model, picked in the viewer). The sheet calls both conical ones "CT90", so
 * the conical saddle tap gets the id ct90s here; ct90 is the conical tap without a saddle.
 */
export const TAP_TYPES = ["sst90", "ct90s", "st90", "ct90"] as const;
export type TapType = (typeof TAP_TYPES)[number];
/** Lateral Taps sheet types (one model, picked in the viewer). */
export const LTAP_TYPES = ["lst45", "lt45"] as const;
export type LtapType = (typeof LTAP_TYPES)[number];
/** Concentric and Eccentric Reducer sheet types (one model, picked in the viewer). */
export const RED_TYPES = ["cr", "er"] as const;
export type RedType = (typeof RED_TYPES)[number];
/** Sheet 10 parts: pipe coupling, fitting coupling, end cap, start collar, bellmouth (one model, picked in the viewer). */
export const CAP_TYPES = ["pc", "fc", "ec", "sc", "bm"] as const;
export type CapType = (typeof CAP_TYPES)[number];
/** Sheet 11 types: wye 45° and reducing wye 45° (one model, picked in the viewer). */
export const WYE_TYPES = ["y45", "ry45"] as const;
export type WyeType = (typeof WYE_TYPES)[number];

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
export const SWF_LAT_3D_HASH = "#/single-wall-fittings/round/3d/lat";
/** Deep link to one lateral type (L45 is the default, so it gets the plain link). */
export const latHash = (t: LatType) => (t === "l45" ? SWF_LAT_3D_HASH : `${SWF_LAT_3D_HASH}?type=${t}`);
export const SWF_TAP_3D_HASH = "#/single-wall-fittings/round/3d/tap";
/** Deep link to one tap type (SST90 is the default, so it gets the plain link). */
export const tapHash = (t: TapType) => (t === "sst90" ? SWF_TAP_3D_HASH : `${SWF_TAP_3D_HASH}?type=${t}`);
export const SWF_LTAP_3D_HASH = "#/single-wall-fittings/round/3d/ltap";
/** Deep link to one lateral tap type (LST45 is the default, so it gets the plain link). */
export const ltapHash = (t: LtapType) => (t === "lst45" ? SWF_LTAP_3D_HASH : `${SWF_LTAP_3D_HASH}?type=${t}`);
export const SWF_RED_3D_HASH = "#/single-wall-fittings/round/3d/red";
/** Deep link to one reducer type (CR is the default, so it gets the plain link). */
export const redHash = (t: RedType) => (t === "cr" ? SWF_RED_3D_HASH : `${SWF_RED_3D_HASH}?type=${t}`);
export const SWF_CAP_3D_HASH = "#/single-wall-fittings/round/3d/cap";
/** Deep link to one sheet 10 part (PC is the default, so it gets the plain link). */
export const capHash = (t: CapType) => (t === "pc" ? SWF_CAP_3D_HASH : `${SWF_CAP_3D_HASH}?type=${t}`);
export const SWF_WYE_3D_HASH = "#/single-wall-fittings/round/3d/wye";
/** Deep link to one wye type (Y45 is the default, so it gets the plain link; ?type=y45 opens it too). */
export const wyeHash = (t: WyeType) => (t === "y45" ? SWF_WYE_3D_HASH : `${SWF_WYE_3D_HASH}?type=${t}`);

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
  if (h === SWF_LAT_3D_HASH || h.startsWith(`${SWF_LAT_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_LAT_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "lat", latType: LAT_TYPES.find((x) => x === t) ?? "l45" };
  }
  if (h === SWF_TAP_3D_HASH || h.startsWith(`${SWF_TAP_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_TAP_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "tap", tapType: TAP_TYPES.find((x) => x === t) ?? "sst90" };
  }
  if (h === SWF_LTAP_3D_HASH || h.startsWith(`${SWF_LTAP_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_LTAP_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "ltap", ltapType: LTAP_TYPES.find((x) => x === t) ?? "lst45" };
  }
  if (h === SWF_RED_3D_HASH || h.startsWith(`${SWF_RED_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_RED_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "red", redType: RED_TYPES.find((x) => x === t) ?? "cr" };
  }
  if (h === SWF_CAP_3D_HASH || h.startsWith(`${SWF_CAP_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_CAP_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "cap", capType: CAP_TYPES.find((x) => x === t) ?? "pc" };
  }
  if (h === SWF_WYE_3D_HASH || h.startsWith(`${SWF_WYE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_WYE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "wye", wyeType: WYE_TYPES.find((x) => x === t) ?? "y45" };
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
