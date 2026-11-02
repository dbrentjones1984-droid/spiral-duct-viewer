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
 *   "#/single-wall-fittings/round/3d/os"      same, with the offset & square to round 3D model open on top (OS shown);
 *   "#/single-wall-fittings/round/3d/os?type=sq2rd"   ... opened on that type (os or sq2rd)
 *   "#/single-wall-fittings/round/3d/hanger"  same, with the clam shell hangers 3D model open on top (Whole shown);
 *   "#/single-wall-fittings/round/3d/hanger?type=half"   ... opened on that type (whole or half)
 *   "#/single-wall-fittings/round/3d/grille"  same, with the grille taps 3D model open on top (GT shown);
 *   "#/single-wall-fittings/round/3d/grille?type=gts"   ... opened on that type (gt, gts or gti)
 *   "#/single-wall-fittings/oval"             Single Wall Fittings · Oval sheets (View 3D Model -> the oval model list)
 *   "#/single-wall-fittings/oval/3d"          list of oval fitting 3D models
 *   "#/single-wall-fittings/oval/3d/elbow"    same, with the oval elbows 3D model open on top (90HB5, hard bend shown);
 *   "#/single-wall-fittings/oval/3d/elbow?type=60hb3&bend=easy"   ... opened on that type (90hb5, 60hb3, 45hb3 or 30hb2)
 *   "#/single-wall-fittings/oval/3d/miter"    same, with the oval mitered elbow (02PV90 H) open; "?bend=easy" for 02PV90 E
 *   "#/single-wall-fittings/oval/3d/tee"      same, with the oval tees & crosses 3D model open on top (0T90 shown);
 *   "#/single-wall-fittings/oval/3d/tee?type=0rt90"   ... opened on that type (0t90, 0rt90, 0c180 or 0rc180)
 *   "#/single-wall-fittings/oval/3d/conical-tee"   same, with the oval conical tees & crosses open on top (OCT90 shown);
 *   "#/single-wall-fittings/oval/3d/conical-tee?type=orct90"   ... opened on that type (oct90, orct90, occ180 or orcc180)
 *   "#/single-wall-fittings/oval/3d/low-loss-tee"   same, with the oval low-loss tees & crosses open on top (OT90-L shown);
 *   "#/single-wall-fittings/oval/3d/low-loss-tee?type=ort90-l"   ... opened on that type (ot90-l, ort90-l, oc180-l or orc180-l)
 *   "#/single-wall-fittings/oval/3d/lateral"   same, with the oval laterals open on top (OL45 shown);
 *   "#/single-wall-fittings/oval/3d/lateral?type=orl45"   ... opened on that type (ol45, orl45, olc45 or orlc45)
 *   "#/single-wall-fittings/oval/3d/reducer"   same, with the oval reducers open on top (CR shown);
 *   "#/single-wall-fittings/oval/3d/reducer?type=er"   ... opened on that type (cr or er)
 *   "#/single-wall-fittings/oval/3d/wye"   same, with the oval wyes open on top (Y45 shown);
 *   "#/single-wall-fittings/oval/3d/wye?type=ry45"   ... opened on that type (y45 or ry45)
 *   "#/single-wall-fittings/oval/3d/coupling"   same, with the oval couplings & ends open on top (PC shown);
 *   "#/single-wall-fittings/oval/3d/coupling?type=bm"   ... opened on that type (pc, fc, oec, of or bm)
 *   "#/single-wall-fittings/oval/3d/offset"   same, with the oval offset & square-to-oval open on top (OS shown);
 *   "#/single-wall-fittings/oval/3d/offset?type=sq2rd"   ... opened on that type (os or sq2rd)
 *                                             and bend (hard or easy)
 *   "#/double-wall/round"      Double Wall Duct · Round catalog sheets (sheet 1, Stock Pipe and Fittings construction; sheets 2-3, gauge tables)
 *   "#/double-wall/round/3d"   same, with the double wall spiral pipe 3D model open on top (Solid / Solid, 1" insulation);
 *   "#/double-wall/round/3d?type=sp&ins=2&conn=flange"   ... opened on that type (ss = Solid / Solid, sp = Solid / Perforated),
 *                                             insulation thickness (1, 2 or 3 inch) and connection (coupling = default,
 *                                             flange or none)
 *   "#/double-wall-fittings/round"   Double Wall Fittings · Round sheets (sheet 1, Gored Elbows; sheet 2, Mitered
 *                                             Elbows; View 3D Model -> the model list)
 *   "#/double-wall-fittings/round/3d"         list of double wall fitting 3D models
 *   "#/double-wall-fittings/round/3d/elbow"   same, with the double wall gored elbow 3D model open on top (DE90,
 *                                             1" insulation, slip joint; fittings always have a solid liner);
 *   "#/double-wall-fittings/round/3d/elbow?type=de45&ins=2&conn=flange"   ... opened on that elbow (de90, de60, de45
 *                                             or de30), insulation (1, 2 or 3 inch) and connection (slip = default,
 *                                             flange or none; coupling also means slip). An old shells= is ignored.
 *   "#/double-wall-fittings/round/3d/miter"   same, with the double wall mitered elbow 3D model open on top (DMEV90,
 *                                             1" insulation, slip joint; solid liner);
 *   "#/double-wall-fittings/round/3d/miter?type=d3p90h&ins=2&conn=flange"   ... opened on that elbow (dmev90, dme90,
 *                                             d3p90 or d3p90h), insulation and connection as the gored elbows
 *   "#/double-wall-fittings/round/3d/bullhead"   same, with the double wall bullhead tee 3D model open on top (DBT90,
 *                                             1" insulation, slip joint; solid liner);
 *   "#/double-wall-fittings/round/3d/bullhead?type=dbtv90&ins=2&conn=flange"   ... opened on that tee (dbt90 or
 *                                             dbtv90), insulation and connection as the gored elbows
 *   "#/double-wall/round/3d/elbow(?...)"   old link (first published on the duct page): replaced by the fittings link
 *                                             above, same query
 */
export type Route =
  | { page: "home" }
  | { page: "sw-round"; model3d: boolean }
  | { page: "sw-oval"; model3d: boolean }
  | { page: "dw-round"; model3d: boolean; dwType: DwType; dwIns: DwIns; dwConn: DwConn }
  | { page: "dwf-round" }
  | { page: "dwf-models"; model3d: "elbow" | "miter" | "bullhead" | null; dwElbow: { type: DwElbowType; ins: DwIns; conn: DwElbowConn }; dwMiter: { type: DwMiterType; ins: DwIns; conn: DwElbowConn }; dwBull: { type: DwBullType; ins: DwIns; conn: DwElbowConn } }
  | { page: "swf-round" }
  | { page: "swf-oval" }
  | { page: "swfo-models"; model3d: "elbow" | "miter" | "tee" | "ctee" | "lltee" | "lat" | "red" | "wye" | "cap" | "offset" | null; ovalElbowType?: OvalElbowType; bend?: OvalBend; ovalTeeType?: OvalTeeType; ovalCteeType?: OvalCteeType; ovalLlteeType?: OvalLlteeType; ovalLatType?: OvalLatType; ovalRedType?: OvalRedType; ovalWyeType?: OvalWyeType; ovalCapType?: OvalCapType; ovalOsType?: OvalOsType }
  | { page: "swf-models"; model3d: "e90" | "ds90" | "me90" | "bt90" | "tee" | "ctee" | "lat" | "tap" | "ltap" | "red" | "cap" | "wye" | "os" | "hanger" | "grille" | null; teeType?: TeeType; cteeType?: CteeType; latType?: LatType; tapType?: TapType; ltapType?: LtapType; redType?: RedType; capType?: CapType; wyeType?: WyeType; osType?: OsType; hangerType?: HangerType; grilleType?: GrilleType };

/** Double wall spiral pipe construction (sheet 1): Solid / Solid or Solid / Perforated (outer shell / inner liner). */
export const DW_TYPES = ["ss", "sp"] as const;
export type DwType = (typeof DW_TYPES)[number];
/** Double wall insulation thickness, inches (sheet 1: 1", 2" and 3", 1-1/2 lb density; 1" standard). */
export const DW_INS = [1, 2, 3] as const;
export type DwIns = (typeof DW_INS)[number];
/** Double wall pipe joint shown on the model: inner + outer couplings (standard slip joint; default), flanged, or none (layers only). */
export const DW_CONNS = ["coupling", "flange", "none"] as const;
export type DwConn = (typeof DW_CONNS)[number];
/** Double wall gored elbows (Double Wall Fittings sheet 1): DE90 5-piece, DE60 / DE45 3-piece, DE30 2-piece (one model, picked in the viewer). */
export const DW_ELBOW_TYPES = ["de90", "de60", "de45", "de30"] as const;
export type DwElbowType = (typeof DW_ELBOW_TYPES)[number];
/** Double wall mitered elbows (Double Wall Fittings sheet 2): DMEV90 2-piece with vanes, DME90 2-piece, D3P90 3-piece, D3P90H 3-piece with the B collar on top (one model, picked in the viewer). */
export const DW_MITER_TYPES = ["dmev90", "dme90", "d3p90", "d3p90h"] as const;
export type DwMiterType = (typeof DW_MITER_TYPES)[number];
/** Double wall bullhead tees (Double Wall Fittings sheet 3): DBT90, and DBTV90 with splitter vanes (one model, picked in the viewer). */
export const DW_BULL_TYPES = ["dbt90", "dbtv90"] as const;
export type DwBullType = (typeof DW_BULL_TYPES)[number];
/** Double wall elbow end: slip joint (inner first, then outer; default), flange, or none (the elbow alone). */
export const DW_ELBOW_CONNS = ["slip", "flange", "none"] as const;
export type DwElbowConn = (typeof DW_ELBOW_CONNS)[number];

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
/** Sheet 12 types: offset and square to round transition (one model, picked in the viewer). */
export const OS_TYPES = ["os", "sq2rd"] as const;
export type OsType = (typeof OS_TYPES)[number];
/** Sheet 13 types: whole and half clam shell hanger (one model, picked in the viewer). */
export const HANGER_TYPES = ["whole", "half"] as const;
export type HangerType = (typeof HANGER_TYPES)[number];
/** Sheet 15 types: grille tap, grille tap with saddle, grille tap installed (one model, picked in the viewer). */
export const GRILLE_TYPES = ["gt", "gts", "gti"] as const;
export type GrilleType = (typeof GRILLE_TYPES)[number];

/** Single Wall Oval Elbows sheet types (one model, picked in the viewer). */
export const OVAL_ELBOW_TYPES = ["90hb5", "60hb3", "45hb3", "30hb2"] as const;
export type OvalElbowType = (typeof OVAL_ELBOW_TYPES)[number];
/** Hard bend: R = 1.5 x A (turns across the major axis); easy bend: R = 1.5 x α (turns across the minor axis). */
/** Single Wall Oval Tees and Crosses sheet types (one model, picked in the viewer). */
export const OVAL_TEE_TYPES = ["0t90", "0rt90", "0c180", "0rc180"] as const;
export type OvalTeeType = (typeof OVAL_TEE_TYPES)[number];
/** Single Wall Oval Conical Tees and Conical Crosses sheet types (one model, picked in the viewer). */
export const OVAL_CTEE_TYPES = ["oct90", "orct90", "occ180", "orcc180"] as const;
export type OvalCteeType = (typeof OVAL_CTEE_TYPES)[number];
/** Single Wall Oval Low-Loss Tees and Crosses sheet types (the sheet labels its crosses OT90-L / ORT90-L too; OC180-L / ORC180-L used). */
export const OVAL_LLTEE_TYPES = ["ot90-l", "ort90-l", "oc180-l", "orc180-l"] as const;
export type OvalLlteeType = (typeof OVAL_LLTEE_TYPES)[number];
/** Single Wall Oval Laterals sheet types (one model, picked in the viewer). */
export const OVAL_LAT_TYPES = ["ol45", "orl45", "olc45", "orlc45"] as const;
export type OvalLatType = (typeof OVAL_LAT_TYPES)[number];
/** Single Wall Oval Concentric and Eccentric Reducer sheet types (one model, picked in the viewer). */
export const OVAL_RED_TYPES = ["cr", "er"] as const;
export type OvalRedType = (typeof OVAL_RED_TYPES)[number];
/** Single Wall Oval Wye and Reducing Wye sheet types (one model, picked in the viewer). */
export const OVAL_WYE_TYPES = ["y45", "ry45"] as const;
export type OvalWyeType = (typeof OVAL_WYE_TYPES)[number];
/** Single Wall Oval couplings & ends sheet types (pipe / fitting coupling, end cap, flange, bell mouth; one model). */
export const OVAL_CAP_TYPES = ["pc", "fc", "oec", "of", "bm"] as const;
export type OvalCapType = (typeof OVAL_CAP_TYPES)[number];
/** Single Wall Oval Offset and Square-to-Round Transition sheet types (one model, picked in the viewer). */
export const OVAL_OS_TYPES = ["os", "sq2rd"] as const;
export type OvalOsType = (typeof OVAL_OS_TYPES)[number];
export const OVAL_BENDS = ["hard", "easy"] as const;
export type OvalBend = (typeof OVAL_BENDS)[number];

export const SW_ROUND_HASH = "#/single-wall/round";
export const SW_ROUND_3D_HASH = "#/single-wall/round/3d";
export const SW_OVAL_HASH = "#/single-wall/oval";
export const SW_OVAL_3D_HASH = "#/single-wall/oval/3d";
export const DW_ROUND_HASH = "#/double-wall/round";
export const DW_ROUND_3D_HASH = "#/double-wall/round/3d";
/** Deep link to the double wall pipe model (Solid / Solid, 1" insulation, coupling is the default, so it gets the plain link). */
export const dwRoundHash = (t: DwType = "ss", ins: DwIns = 1, conn: DwConn = "coupling") => {
  const q = [t !== "ss" ? `type=${t}` : "", ins !== 1 ? `ins=${ins}` : "", conn !== "coupling" ? `conn=${conn}` : ""].filter(Boolean).join("&");
  return q ? `${DW_ROUND_3D_HASH}?${q}` : DW_ROUND_3D_HASH;
};
export const DWF_ROUND_HASH = "#/double-wall-fittings/round";
export const DWF_ROUND_3D_HASH = "#/double-wall-fittings/round/3d";
export const DW_ELBOW_3D_HASH = "#/double-wall-fittings/round/3d/elbow";
export const DW_MITER_3D_HASH = "#/double-wall-fittings/round/3d/miter";
export const DW_BULL_3D_HASH = "#/double-wall-fittings/round/3d/bullhead";
/** Where the elbow model was first published (on the duct page); old links are sent on to DW_ELBOW_3D_HASH. */
const OLD_DW_ELBOW_3D_HASH = "#/double-wall/round/3d/elbow";
/** Deep link to the double wall gored elbow model (defaults left out: DE90, 1" insulation, slip joint). */
export const dwElbowHash = (t: DwElbowType = "de90", ins: DwIns = 1, conn: DwElbowConn = "slip") => {
  const q = [t !== "de90" ? `type=${t}` : "", ins !== 1 ? `ins=${ins}` : "", conn !== "slip" ? `conn=${conn}` : ""].filter(Boolean).join("&");
  return q ? `${DW_ELBOW_3D_HASH}?${q}` : DW_ELBOW_3D_HASH;
};
/** Deep link to the double wall mitered elbow model (defaults left out: DMEV90, 1" insulation, slip joint). */
export const dwMiterHash = (t: DwMiterType = "dmev90", ins: DwIns = 1, conn: DwElbowConn = "slip") => {
  const q = [t !== "dmev90" ? `type=${t}` : "", ins !== 1 ? `ins=${ins}` : "", conn !== "slip" ? `conn=${conn}` : ""].filter(Boolean).join("&");
  return q ? `${DW_MITER_3D_HASH}?${q}` : DW_MITER_3D_HASH;
};
/** Deep link to the double wall bullhead tee model (defaults left out: DBT90, 1" insulation, slip joint). */
export const dwBullHash = (t: DwBullType = "dbt90", ins: DwIns = 1, conn: DwElbowConn = "slip") => {
  const q = [t !== "dbt90" ? `type=${t}` : "", ins !== 1 ? `ins=${ins}` : "", conn !== "slip" ? `conn=${conn}` : ""].filter(Boolean).join("&");
  return q ? `${DW_BULL_3D_HASH}?${q}` : DW_BULL_3D_HASH;
};
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
export const SWF_OS_3D_HASH = "#/single-wall-fittings/round/3d/os";
/** Deep link to one sheet 12 type (OS is the default, so it gets the plain link; ?type=os opens it too). */
export const osHash = (t: OsType) => (t === "os" ? SWF_OS_3D_HASH : `${SWF_OS_3D_HASH}?type=${t}`);
export const SWF_HANGER_3D_HASH = "#/single-wall-fittings/round/3d/hanger";
/** Deep link to one sheet 13 type (Whole is the default, so it gets the plain link; ?type=whole opens it too). */
export const hangerHash = (t: HangerType) => (t === "whole" ? SWF_HANGER_3D_HASH : `${SWF_HANGER_3D_HASH}?type=${t}`);
export const SWF_GRILLE_3D_HASH = "#/single-wall-fittings/round/3d/grille";
/** Deep link to one sheet 15 type (GT is the default, so it gets the plain link; ?type=gt opens it too). */
export const grilleHash = (t: GrilleType) => (t === "gt" ? SWF_GRILLE_3D_HASH : `${SWF_GRILLE_3D_HASH}?type=${t}`);

export const SWF_OVAL_HASH = "#/single-wall-fittings/oval";
export const SWFO_MODELS_HASH = "#/single-wall-fittings/oval/3d";
export const SWFO_ELBOW_3D_HASH = "#/single-wall-fittings/oval/3d/elbow";
/** Deep link to one oval elbow type and bend (90HB5 hard is the default, so it gets the plain link). */
export const ovalElbowHash = (t: OvalElbowType, bend: OvalBend = "hard") => {
  const q = [t !== "90hb5" ? `type=${t}` : "", bend !== "hard" ? `bend=${bend}` : ""].filter(Boolean).join("&");
  return q ? `${SWFO_ELBOW_3D_HASH}?${q}` : SWFO_ELBOW_3D_HASH;
};
export const SWFO_MITER_3D_HASH = "#/single-wall-fittings/oval/3d/miter";
/** Deep link to the oval mitered elbow (02PV90 H is the default; "?bend=easy" for 02PV90 E). */
export const ovalMiterHash = (bend: OvalBend = "hard") => (bend !== "hard" ? `${SWFO_MITER_3D_HASH}?bend=${bend}` : SWFO_MITER_3D_HASH);
export const SWFO_TEE_3D_HASH = "#/single-wall-fittings/oval/3d/tee";
/** Deep link to one oval tee/cross type (0T90 is the default, so it gets the plain link). */
export const ovalTeeHash = (t: OvalTeeType = "0t90") => (t !== "0t90" ? `${SWFO_TEE_3D_HASH}?type=${t}` : SWFO_TEE_3D_HASH);
export const SWFO_CTEE_3D_HASH = "#/single-wall-fittings/oval/3d/conical-tee";
/** Deep link to one oval conical tee/cross type (OCT90 is the default, so it gets the plain link). */
export const ovalCteeHash = (t: OvalCteeType = "oct90") => (t !== "oct90" ? `${SWFO_CTEE_3D_HASH}?type=${t}` : SWFO_CTEE_3D_HASH);
export const SWFO_LLTEE_3D_HASH = "#/single-wall-fittings/oval/3d/low-loss-tee";
/** Deep link to one oval low-loss tee/cross type (OT90-L is the default, so it gets the plain link). */
export const ovalLlteeHash = (t: OvalLlteeType = "ot90-l") => (t !== "ot90-l" ? `${SWFO_LLTEE_3D_HASH}?type=${t}` : SWFO_LLTEE_3D_HASH);
export const SWFO_LAT_3D_HASH = "#/single-wall-fittings/oval/3d/lateral";
/** Deep link to one oval lateral type (OL45 is the default, so it gets the plain link). */
export const ovalLatHash = (t: OvalLatType = "ol45") => (t !== "ol45" ? `${SWFO_LAT_3D_HASH}?type=${t}` : SWFO_LAT_3D_HASH);
export const SWFO_RED_3D_HASH = "#/single-wall-fittings/oval/3d/reducer";
/** Deep link to one oval reducer type (CR is the default, so it gets the plain link). */
export const ovalRedHash = (t: OvalRedType = "cr") => (t !== "cr" ? `${SWFO_RED_3D_HASH}?type=${t}` : SWFO_RED_3D_HASH);
export const SWFO_WYE_3D_HASH = "#/single-wall-fittings/oval/3d/wye";
/** Deep link to one oval wye type (Y45 is the default, so it gets the plain link). */
export const ovalWyeHash = (t: OvalWyeType = "y45") => (t !== "y45" ? `${SWFO_WYE_3D_HASH}?type=${t}` : SWFO_WYE_3D_HASH);
export const SWFO_CAP_3D_HASH = "#/single-wall-fittings/oval/3d/coupling";
/** Deep link to one oval coupling / end type (PC is the default, so it gets the plain link). */
export const ovalCapHash = (t: OvalCapType = "pc") => (t !== "pc" ? `${SWFO_CAP_3D_HASH}?type=${t}` : SWFO_CAP_3D_HASH);
export const SWFO_OS_3D_HASH = "#/single-wall-fittings/oval/3d/offset";
/** Deep link to one oval offset / square-to-oval type (OS is the default, so it gets the plain link). */
export const ovalOsHash = (t: OvalOsType = "os") => (t !== "os" ? `${SWFO_OS_3D_HASH}?type=${t}` : SWFO_OS_3D_HASH);

function parse(hash: string): Route {
  const h = hash.replace(/\/+$/, "");
  if (h === SW_ROUND_3D_HASH) return { page: "sw-round", model3d: true };
  if (h === SW_ROUND_HASH) return { page: "sw-round", model3d: false };
  if (h === SW_OVAL_3D_HASH) return { page: "sw-oval", model3d: true };
  if (h === SW_OVAL_HASH) return { page: "sw-oval", model3d: false };
  if (h === DW_ROUND_HASH) return { page: "dw-round", model3d: false, dwType: "ss", dwIns: 1, dwConn: "coupling" };
  {
    // Double wall fittings models: the gored elbows, the mitered elbows or the bullhead tees, type / insulation /
    // connection from the query.
    const is = (base: string) => h === base || h.startsWith(`${base}?`);
    const fam = is(DW_ELBOW_3D_HASH) ? "elbow" : is(DW_MITER_3D_HASH) ? "miter" : is(DW_BULL_3D_HASH) ? "bullhead" : null;
    if (fam) {
      const q = new URLSearchParams(h.slice((fam === "elbow" ? DW_ELBOW_3D_HASH : fam === "miter" ? DW_MITER_3D_HASH : DW_BULL_3D_HASH).length + 1));
      const t = q.get("type")?.toLowerCase();
      const ins = DW_INS.find((x) => x === Number(q.get("ins")?.replace(/[^0-9]/g, ""))) ?? 1;
      const c = q.get("conn")?.toLowerCase();
      const conn = DW_ELBOW_CONNS.find((x) => x === (c === "coupling" ? "slip" : c)) ?? "slip";
      return {
        page: "dwf-models",
        model3d: fam,
        dwElbow: { type: (fam === "elbow" && DW_ELBOW_TYPES.find((x) => x === t)) || "de90", ins, conn },
        dwMiter: { type: (fam === "miter" && DW_MITER_TYPES.find((x) => x === t)) || "dmev90", ins, conn },
        dwBull: { type: (fam === "bullhead" && DW_BULL_TYPES.find((x) => x === t)) || "dbt90", ins, conn },
      };
    }
  }
  if (h === DWF_ROUND_3D_HASH) return { page: "dwf-models", model3d: null, dwElbow: { type: "de90", ins: 1, conn: "slip" }, dwMiter: { type: "dmev90", ins: 1, conn: "slip" }, dwBull: { type: "dbt90", ins: 1, conn: "slip" } };
  if (h === DWF_ROUND_HASH) return { page: "dwf-round" };
  if (h === DW_ROUND_3D_HASH || h.startsWith(`${DW_ROUND_3D_HASH}?`)) {
    const q = new URLSearchParams(h.slice(DW_ROUND_3D_HASH.length + 1));
    const t = q.get("type")?.toLowerCase();
    const ins = Number(q.get("ins")?.replace(/[^0-9]/g, ""));
    const conn = q.get("conn")?.toLowerCase();
    return { page: "dw-round", model3d: true, dwType: DW_TYPES.find((x) => x === t) ?? "ss", dwIns: DW_INS.find((x) => x === ins) ?? 1, dwConn: DW_CONNS.find((x) => x === conn) ?? "coupling" };
  }
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
  if (h === SWF_OS_3D_HASH || h.startsWith(`${SWF_OS_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_OS_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "os", osType: OS_TYPES.find((x) => x === t) ?? "os" };
  }
  if (h === SWF_HANGER_3D_HASH || h.startsWith(`${SWF_HANGER_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_HANGER_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "hanger", hangerType: HANGER_TYPES.find((x) => x === t) ?? "whole" };
  }
  if (h === SWF_GRILLE_3D_HASH || h.startsWith(`${SWF_GRILLE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWF_GRILLE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swf-models", model3d: "grille", grilleType: GRILLE_TYPES.find((x) => x === t) ?? "gt" };
  }
  if (h === SWFO_ELBOW_3D_HASH || h.startsWith(`${SWFO_ELBOW_3D_HASH}?`)) {
    const q = new URLSearchParams(h.slice(SWFO_ELBOW_3D_HASH.length + 1));
    const t = q.get("type")?.toLowerCase();
    const b = q.get("bend")?.toLowerCase();
    return {
      page: "swfo-models",
      model3d: "elbow",
      ovalElbowType: OVAL_ELBOW_TYPES.find((x) => x === t) ?? "90hb5",
      bend: OVAL_BENDS.find((x) => x === b) ?? "hard",
    };
  }
  if (h === SWFO_MITER_3D_HASH || h.startsWith(`${SWFO_MITER_3D_HASH}?`)) {
    const b = new URLSearchParams(h.slice(SWFO_MITER_3D_HASH.length + 1)).get("bend")?.toLowerCase();
    return { page: "swfo-models", model3d: "miter", bend: OVAL_BENDS.find((x) => x === b) ?? "hard" };
  }
  if (h === SWFO_TEE_3D_HASH || h.startsWith(`${SWFO_TEE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_TEE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "tee", ovalTeeType: OVAL_TEE_TYPES.find((x) => x === t) ?? "0t90" };
  }
  if (h === SWFO_CTEE_3D_HASH || h.startsWith(`${SWFO_CTEE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_CTEE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "ctee", ovalCteeType: OVAL_CTEE_TYPES.find((x) => x === t) ?? "oct90" };
  }
  if (h === SWFO_LLTEE_3D_HASH || h.startsWith(`${SWFO_LLTEE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_LLTEE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "lltee", ovalLlteeType: OVAL_LLTEE_TYPES.find((x) => x === t) ?? "ot90-l" };
  }
  if (h === SWFO_LAT_3D_HASH || h.startsWith(`${SWFO_LAT_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_LAT_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "lat", ovalLatType: OVAL_LAT_TYPES.find((x) => x === t) ?? "ol45" };
  }
  if (h === SWFO_RED_3D_HASH || h.startsWith(`${SWFO_RED_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_RED_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "red", ovalRedType: OVAL_RED_TYPES.find((x) => x === t) ?? "cr" };
  }
  if (h === SWFO_WYE_3D_HASH || h.startsWith(`${SWFO_WYE_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_WYE_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "wye", ovalWyeType: OVAL_WYE_TYPES.find((x) => x === t) ?? "y45" };
  }
  if (h === SWFO_CAP_3D_HASH || h.startsWith(`${SWFO_CAP_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_CAP_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "cap", ovalCapType: OVAL_CAP_TYPES.find((x) => x === t) ?? "pc" };
  }
  if (h === SWFO_OS_3D_HASH || h.startsWith(`${SWFO_OS_3D_HASH}?`)) {
    const t = new URLSearchParams(h.slice(SWFO_OS_3D_HASH.length + 1)).get("type")?.toLowerCase();
    return { page: "swfo-models", model3d: "offset", ovalOsType: OVAL_OS_TYPES.find((x) => x === t) ?? "os" };
  }
  if (h === SWFO_MODELS_HASH) return { page: "swfo-models", model3d: null };
  if (h === SWF_OVAL_HASH) return { page: "swf-oval" };
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

/**
 * Home button: to the start page (no hash) from anywhere, closing any open 3D model. Steps back over the in-app history
 * first (so the phone's back button doesn't walk through the pages again), then makes that entry the start page.
 */
export function goHome() {
  const toRoot = () => {
    history.replaceState(null, "", location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  if (pushed > 0) {
    const n = pushed;
    pushed = 0;
    window.addEventListener("popstate", toRoot, { once: true });
    history.go(-n);
  } else {
    toRoot();
  }
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

/** Old elbow links (#/double-wall/round/3d/elbow...) are rewritten in place to the fittings link, same query. */
function current(): Route {
  const h = location.hash;
  if (h === OLD_DW_ELBOW_3D_HASH || h.startsWith(`${OLD_DW_ELBOW_3D_HASH}?`) || h.startsWith(`${OLD_DW_ELBOW_3D_HASH}/`)) {
    history.replaceState(history.state, "", location.pathname + location.search + DW_ELBOW_3D_HASH + h.slice(OLD_DW_ELBOW_3D_HASH.length));
  }
  return parse(location.hash);
}

export function useHashRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const on = () => setRoute(current());
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);
  return route;
}
