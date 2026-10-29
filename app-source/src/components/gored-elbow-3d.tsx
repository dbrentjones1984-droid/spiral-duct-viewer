import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  buildCoupling,
  buildFlange,
  CONNECTIONS,
  JOIN_LENGTH,
  samples,
  screwCount,
  screwMesh,
  screwScale,
  shell,
  type BuiltConnection,
  type Connection,
} from "@/components/duct-connections";
import { buildPipe, shadowTexture, spangleTexture, type PipeMats } from "@/components/spiral-pipe-3d";
import { capHash, CAP_TYPES, SWF_CAP_3D_HASH, SWF_WYE_3D_HASH, type CapType, wyeHash, WYE_TYPES, type WyeType, osHash, OS_TYPES, SWF_OS_3D_HASH, type OsType, hangerHash, HANGER_TYPES, SWF_HANGER_3D_HASH, type HangerType, cteeHash, CTEE_TYPES, latHash, LAT_TYPES, ltapHash, LTAP_TYPES, redHash, RED_TYPES, SWF_CTEE_3D_HASH, SWF_LAT_3D_HASH, SWF_LTAP_3D_HASH, SWF_RED_3D_HASH, SWF_TAP_3D_HASH, SWF_TEE_3D_HASH, tapHash, TAP_TYPES, teeHash, TEE_TYPES, type CteeType, type LatType, type LtapType, type RedType, type TapType, type TeeType } from "@/lib/route";
import { STOCK_DIAMETERS, stockGauge } from "@/lib/sheets";

/*
 * 3D model of the E90, the 90° 5-piece gored elbow (Single Wall Round, catalog page 7 "Gored Elbows"):
 * centerline radius R = 1.5 x diameter A, two 11-1/4° end gores and three 22-1/2° middle gores, each a straight
 * piece of round pipe mitred where it meets the next one, with a raised seam at every gore joint and a 2" straight
 * collar on each end. No spiral seam: gored elbows are pieced, not spiral. Same viewer feel as the Round pipe
 * (shared spangle and shadow textures, lighting, orbit, auto-spin). Units are inches.
 * Connections (Brent), shown on the elbow's bottom end joined to a 12" piece of spiral duct, with Play like the duct:
 * Coupling (slip joint: crimped end past the bead, the duct slides over it and is screwed) and Flange (plain ends,
 * the duct's flange joint).
 * The same viewer also shows the die-stamped 90° elbow (kind "ds90", sizes 3"-10" only): one smooth bend pressed
 * from two halves that are joined along the throat and the heel (the inside and outside of the bend), so a raised
 * lap seam runs lengthwise along both; same 2" ends, connections and Play.
 * And the mitered 90° elbow (kind "me90", catalog sheet "Mitered Elbows"): two straight pieces of round pipe cut at
 * 45° and seamed along the cut, a sharp square corner (no radius). Each leg runs 4" past the other leg's outside
 * wall (the sheet's 4" dimension), ending in a 2" beaded collar. With Vanes on (MEV90, 8" and up) it adds the curved
 * quarter-arc turning vanes set along the miter, across the full duct, counted by size as on the sheet, and shows
 * the walls see-through so the vanes read on a phone.
 * And the 90° bullhead tee (kind "bt90", catalog sheet "Bullhead Tees"): a straight body of diameter A, L = A + 3"
 * long, with the branch A coming out of the bottom centre (TEE_BRANCH below the body, ending in a 2" beaded collar),
 * and on each run end a concentric reducer down to B (left) and C (right), each with a 2" beaded end. The sheet says
 * "R = refer to reducer drawing": reducerLength(), the concentric reducer's R from the reducer sheet. With Vanes on (BTV90)
 * it adds curved splitter vanes in a mirrored pair of sets, turning the branch flow out to both run ends (count by A,
 * same table as the MEV90 - an assumption), walls see-through. Connections go on the branch end.
 * And the tees & crosses (kind "tee", catalog sheet "Tees and Crosses"), one model with a type picker: a straight main
 * of diameter A, L = largest tap + 3" long between the 2" beaded ends, with round taps centred on it that meet it in a
 * saddle (the two cylinders' intersection) and end TEE_BRANCH out from the main's wall in a 2" beaded collar:
 *   T90   tee 90°: A both ends, tap B on top.
 *   RT90  reducing tee 90°: A in on the left, reducer R down to outlet B on the right, tap C on top.
 *   C180  cross 180°: A both ends, tap B on top and tap C on the bottom.
 *   RC180 reducing cross 180°: A in, reducer R to B, taps C on top and D on the bottom.
 * R is the concentric reducer's (reducerLength(), reducer sheet). Connections go on the A inlet end (left). No vanes.
 * And the conical tees & crosses (kind "ctee", catalog sheet "Conical Tees and Conical Crosses"), same layout with a
 * type picker, L = top tap + 5" between the 2" beaded ends, but each tap is a cone: its 2" beaded collar, then a cone
 * CONE_H (5") tall flaring wider down to the main, CONE_FLARE (1") each side along the main (base = tap + 2" where it
 * meets the main's top line; it keeps the tap's width across the main, so every tap up to A fits on the main):
 *   CT90   conical tee 90°: A both ends, cone tap B on top.
 *   RCT90  reducing conical tee 90°: A in, reducer R to outlet B on the right, cone tap C on top.
 *   CC180  conical cross 180°: A both ends, cone taps B on top and C on the bottom (C up to B).
 *   RCC180 reducing conical cross 180°: A in, reducer R to B, cone taps C on top and D on the bottom (D up to C).
 * And the laterals (kind "lat", catalog sheet "Laterals"), same layout with a type picker, L = top branch x 1.414 + 3"
 * between the 2" beaded ends (rounded to the nearest 1/2"), each branch a round pipe at 45° leaning to the outlet (right),
 * meeting the main in a true saddle with a seam, LAT_STRAIGHT (the sheet's inner 2", read as the straight branch between
 * the main and the bead on the branch's short side) then a 2" beaded collar:
 *   L45    lateral 45°: A both ends, branch B on top.
 *   RL45   reducing lateral 45°: A in, reducer R to outlet B on the right, branch C on top.
 *   LC45   lateral cross 45°: A both ends, branches B on top and C on the bottom (C up to B).
 *   RLC45  reducing lateral cross 45°: A in, reducer R to B, branches C on top and D on the bottom (D up to C).
 * And the reducers (kind "red", catalog sheet "Concentric and Eccentric Reducer"), one model with a type picker: the
 * large end A's 2" beaded end, a cone R long, then the small end B's 2" beaded end (B smaller than A):
 *   CR  concentric reducer: the cone centred; R by the reduction A - B from the sheet's table (reducerLength()).
 *   ER  eccentric reducer: flat along one side (the bottom, as drawn); R = 6" for A - B of 1"-3", else (A - B) x 1.5.
 * Connections go on the small B end.
 * And the clam shell hangers (kind "hanger", catalog sheet "Clam Shell Hangers"), see buildHanger(): whole or half, on a
 * see-through pipe and rods, no connection buttons; Play shows how it goes on.
 */

const TEX_LENGTH = 48; // spangle size matches the Round pipe's 4 ft section
const COLLAR = 2; // straight ends, as dimensioned on the sheet
const DEG = Math.PI / 180;
/**
 * Clam shell hanger sizes: the sheet covers 3"-64". The stock round list (3"-10", then even sizes to 24") extended in
 * even sizes to 64", plus 15" (the end of the sheet's 3"-15" table row). No odd sizes past 15", so the table's gaps
 * (29", 39") never come up.
 */
const HANGER_SIZES = [...STOCK_DIAMETERS, 15, ...Array.from({ length: 20 }, (_, i) => 26 + i * 2)].sort((a, b) => a - b);
/** Gore joints along the 90° turn: end gores 11-1/4°, middle gores 22-1/2°. */
const SEAMS = [0, 11.25, 33.75, 56.25, 78.75, 90].map((a) => a * DEG);

/** Die-stamped elbow: centerline radius (x diameter) and the sizes it is made in. */
const DS_CLR = 1.5;
const DS_MAX_D = 10;

/** Mitered elbow: each leg runs MITER_LEG past the other leg's outside wall, collar included (sheet's 4"). */
const MITER_LEG = 4;
/** MEV90 turning vanes by diameter (sheet's table). */
const VANE_TABLE = [
  { from: 8, to: 9, n: 2 },
  { from: 10, to: 14, n: 3 },
  { from: 15, to: 19, n: 4 },
  { from: 20, to: 60, n: 5 },
] as const;
export const VANES_FROM = VANE_TABLE[0].from;
export function vaneSpec(d: number) {
  const row = VANE_TABLE.find((v) => d >= v.from && d <= v.to);
  return row ? { n: row.n, range: `${row.from}″–${row.to}″` } : null;
}

/** Bullhead tee: body length L = A + TEE_EXTRA (sheet); the branch runs TEE_BRANCH below the body, collar included. */
const TEE_EXTRA = 3;
const TEE_BRANCH = 4;
/** Conical taps (sheet): the cone is 5" tall from the main's wall to the collar, L = top tap + 5". */
const CONE_H = 5;
const CTEE_EXTRA = 5;
/** Cone flare each side along the main, at the main's top line (base = tap + 2"; assumed, sheet shows no number). */
const CONE_FLARE = 1;
/** Laterals (sheet): L = top branch x LAT_FACTOR + LAT_EXTRA; LAT_STRAIGHT of straight branch before its 2" collar. */
const LAT_FACTOR = 1.414;
const LAT_EXTRA = 3;
const LAT_STRAIGHT = 2;
/**
 * Taps (sheet): TAP_H tall above the pipe's top line, the 2" beaded collar included. Assumed (sheet shows no number): the
 * cone runs the rest (TAP_CONE_H) and flares TAP_FLARE each side along the pipe (base A + 2"); the saddle plate reaches
 * TAP_SADDLE past the tap all round (the sheet's 1").
 */
const TAP_H = 5;
const TAP_CONE_H = TAP_H - COLLAR;
const TAP_FLARE = 1;
const TAP_SADDLE = 1;
/**
 * Lateral taps (sheet "Lateral Taps"): footprint along the pipe = A x LAT_FACTOR; the saddle plate is LTAP_EXTRA longer
 * (sheet: L = C x 1.414 + 3", C read as A) and reaches TAP_SADDLE past the branch across the pipe (assumed).
 */
const LTAP_EXTRA = 3;
/**
 * Concentric reducer length R from A down to B (sheet "Concentric and Eccentric Reducer", CR table): by the reduction
 * A - B, 1"-4" -> 4", 5"-8" -> 8", 9"-12" -> 12", 13"-16" -> 16". Past the table (17"+, assumed) it goes on in the same
 * 4" steps (17"-20" -> 20", 21"-24" -> 24"). None when B is the full size. Also the tee/lateral reducers' R.
 */
export const CR_TABLE_MAX = 16;
export function reducerLength(a: number, b: number) {
  if (b >= a) return 0;
  return Math.ceil((a - b) / 4) * 4;
}
/** Eccentric reducer length R (sheet, ER): 6" for a reduction of 1"-3", else (A - B) x 1.5 (whole sizes: always a 1/2"). */
export function eccentricLength(a: number, b: number) {
  if (b >= a) return 0;
  const d = a - b;
  return d <= 3 ? 6 : d * 1.5;
}

/** The elbows this viewer shows. */
export type ElbowKind = "e90" | "ds90" | "me90" | "bt90" | "tee" | "ctee" | "lat" | "tap" | "ltap" | "red" | "cap" | "wye" | "os" | "hanger";
const ELBOWS: Record<
  ElbowKind,
  { clr: number; sizes: readonly number[]; defaultD: number; name: string; aria: string; canvas: string; none: { title: string; text: string }; note: string }
> = {
  e90: {
    clr: 1.5,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Gored 90° Elbow (E90)",
    aria: "3D model: single wall round gored 90 degree elbow",
    canvas: "3D gored 90 degree elbow. Drag to turn, pinch to zoom.",
    none: { title: "Gored 90° Elbow (E90)", text: "90° 5-piece gored elbow. Centerline radius 1.5 × diameter, 2″ straight ends." },
    note: "Galvanized · 5 gores",
  },
  ds90: {
    clr: DS_CLR,
    sizes: STOCK_DIAMETERS.filter((d) => d <= DS_MAX_D),
    defaultD: 6,
    name: "Die-Stamped 90° Elbow",
    aria: "3D model: single wall round die-stamped 90 degree elbow",
    canvas: "3D die-stamped 90 degree elbow. Drag to turn, pinch to zoom.",
    none: {
      title: "Die-Stamped 90° Elbow",
      text: `Smooth stamped elbow, sizes 3″–${DS_MAX_D}″. Two pressed halves seamed along the throat and heel; centerline radius ${DS_CLR} × diameter, 2″ straight ends.`,
    },
    note: "Galvanized · stamped",
  },
  me90: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Mitered 90° Elbow (ME90)",
    aria: "3D model: single wall round 2-piece mitered 90 degree elbow",
    canvas: "3D 2-piece mitered 90 degree elbow. Drag to turn, pinch to zoom.",
    none: {
      title: "Mitered 90° Elbow (ME90)",
      text: `90° 2-piece mitered elbow: two straight pieces seamed at a 45° cut, square corner. Each leg runs ${MITER_LEG}″ past the other, 2″ beaded collars.`,
    },
    note: "Galvanized · mitered",
  },
  bt90: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Bullhead Tee 90° (BT90)",
    aria: "3D model: single wall round 90 degree bullhead tee",
    canvas: "3D 90 degree bullhead tee. Drag to turn, pinch to zoom.",
    none: {
      title: "Bullhead Tee 90° (BT90)",
      text: `Branch A in the bottom of a straight body, L = A + ${TEE_EXTRA}″. Reducers down to B and C on the run ends, 2″ beaded ends.`,
    },
    note: "Galvanized · bullhead",
  },
  tee: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Tee 90° (T90)",
    aria: "3D model: single wall round tees and crosses",
    canvas: "3D tee or cross. Drag to turn, pinch to zoom.",
    none: { title: "Tee 90° (T90)", text: "" },
    note: "Galvanized",
  },
  ctee: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Conical Tee 90° (CT90)",
    aria: "3D model: single wall round conical tees and conical crosses",
    canvas: "3D conical tee or cross. Drag to turn, pinch to zoom.",
    none: { title: "Conical Tee 90° (CT90)", text: "" },
    note: "Galvanized",
  },
  lat: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Lateral 45° (L45)",
    aria: "3D model: single wall round laterals and lateral crosses",
    canvas: "3D lateral or lateral cross. Drag to turn, pinch to zoom.",
    none: { title: "Lateral 45° (L45)", text: "" },
    note: "Galvanized",
  },
  tap: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 8,
    name: "Straight Saddle Tap 90° (SST90)",
    aria: "3D model: single wall round straight and conical taps",
    canvas: "3D straight or conical tap on a see-through pipe. Drag to turn, pinch to zoom.",
    none: { title: "Straight Saddle Tap 90° (SST90)", text: "" },
    note: "Galvanized",
  },
  ltap: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 8,
    name: "Lateral Saddle Tap 45° (LST45)",
    aria: "3D model: single wall round lateral taps",
    canvas: "3D lateral tap on a see-through pipe. Drag to turn, pinch to zoom.",
    none: { title: "Lateral Saddle Tap 45° (LST45)", text: "" },
    note: "Galvanized",
  },
  red: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Concentric Reducer (CR)",
    aria: "3D model: single wall round concentric and eccentric reducers",
    canvas: "3D concentric or eccentric reducer. Drag to turn, pinch to zoom.",
    none: { title: "Concentric Reducer (CR)", text: "" },
    note: "Galvanized",
  },
  cap: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Pipe Coupling (PC)",
    aria: "3D model: single wall round couplings, end cap, start collar and bellmouth",
    canvas: "3D coupling, end cap, start collar or bellmouth, with see-through duct. Drag to turn, pinch to zoom.",
    none: { title: "Pipe Coupling (PC)", text: "" },
    note: "Galvanized",
  },
  wye: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Wye 45° (Y45)",
    aria: "3D model: single wall round wye and reducing wye",
    canvas: "3D wye or reducing wye. Drag to turn, pinch to zoom.",
    none: { title: "Wye 45° (Y45)", text: "" },
    note: "Galvanized",
  },
  os: {
    clr: 0,
    sizes: STOCK_DIAMETERS,
    defaultD: 12,
    name: "Offset (OS)",
    aria: "3D model: single wall round offset and square to round transition",
    canvas: "3D offset or square to round transition. Drag to turn, pinch to zoom.",
    none: { title: "Offset (OS)", text: "" },
    note: "Galvanized",
  },
  hanger: {
    clr: 0,
    sizes: HANGER_SIZES,
    defaultD: 12,
    name: "Whole Clam Shell Hanger",
    aria: "3D model: single wall round whole and half clam shell hangers",
    canvas: "3D clam shell hanger on a see-through pipe and threaded rods. Drag to turn, pinch to zoom.",
    none: { title: "Whole Clam Shell Hanger", text: "" },
    note: "Galvanized",
  },
};

/**
 * Tees & Crosses types (sheet): the size selects in order (first is always the main A), their defaults, and which
 * size is the outlet on the right (reducer when smaller than A), the top tap and the bottom tap.
 */
const TEES: Record<
  TeeType,
  { code: string; name: string; labels: readonly string[]; defaults: readonly number[]; out: number; top: number; bottom: number | null; lRule: string; text: string }
> = {
  t90: {
    code: "T90",
    name: "Tee 90°",
    labels: ["A · main", "B · tap"],
    defaults: [12, 8],
    out: 0,
    top: 1,
    bottom: null,
    lRule: "B + 3″",
    text: "Main A straight through, tap B on top, centred on the body. L = B + 3″ between the 2″ beaded ends.",
  },
  rt90: {
    code: "RT90",
    name: "Reducing Tee 90°",
    labels: ["A · inlet", "B · outlet", "C · tap"],
    defaults: [12, 10, 8],
    out: 1,
    top: 2,
    bottom: null,
    lRule: "C + 3″",
    text: "Main A in on the left, reducer R down to outlet B on the right, tap C on top. L = C + 3″, 2″ beaded ends.",
  },
  c180: {
    code: "C180",
    name: "Cross 180°",
    labels: ["A · main", "B · top", "C · bottom"],
    defaults: [12, 8, 8],
    out: 0,
    top: 1,
    bottom: 2,
    lRule: "largest tap + 3″",
    text: "Main A straight through, tap B on top and tap C on the bottom, opposite. L = largest tap + 3″, 2″ beaded ends.",
  },
  rc180: {
    code: "RC180",
    name: "Reducing Cross 180°",
    labels: ["A · inlet", "B · outlet", "C · top", "D · bottom"],
    defaults: [12, 10, 8, 8],
    out: 1,
    top: 2,
    bottom: 3,
    lRule: "largest tap + 3″",
    text: "Main A in, reducer R down to outlet B on the right, tap C on top and tap D on the bottom. L = largest tap + 3″.",
  },
};
/** The main, outlet and tap sizes of a tee/cross (bottom 0 = none), its body length L and reducer R. */
function teeDims(type: TeeType, sizes: readonly number[]) {
  const t = TEES[type];
  const a = sizes[0];
  const out = sizes[t.out];
  const top = sizes[t.top];
  const bottom = t.bottom === null ? 0 : sizes[t.bottom];
  return { a, out, top, bottom, L: Math.max(top, bottom) + TEE_EXTRA, R: reducerLength(a, out), reducing: t.out !== 0 };
}
/** One tee/cross type's sizes and text (Tees & Crosses or Conical); bound[i] = the size select i is limited by. */
type CrossSpec = (typeof TEES)[TeeType] & { bound?: readonly number[] };

/**
 * Conical Tees and Conical Crosses types (sheet), same fields as TEES. The bottom tap is limited by the top one (sheet:
 * "B > C" / "C > D"; equal is allowed here, L still follows the top tap), the rest by A.
 */
const CTEES: Record<CteeType, CrossSpec> = {
  ct90: {
    code: "CT90",
    name: "Conical Tee 90°",
    labels: ["A · main", "B · tap"],
    defaults: [12, 8],
    out: 0,
    top: 1,
    bottom: null,
    lRule: "B + 5″",
    text: "Main A straight through, cone tap B on top: 2″ collar, then a 5″ cone flaring to B + 2″ on the main. L = B + 5″.",
  },
  rct90: {
    code: "RCT90",
    name: "Reducing Conical Tee 90°",
    labels: ["A · inlet", "B · outlet", "C · tap"],
    defaults: [12, 10, 8],
    out: 1,
    top: 2,
    bottom: null,
    lRule: "C + 5″",
    text: "Main A in on the left, reducer R down to outlet B on the right, cone tap C on top. L = C + 5″, 2″ beaded ends.",
  },
  cc180: {
    code: "CC180",
    name: "Conical Cross 180°",
    labels: ["A · main", "B · top", "C · bottom"],
    defaults: [12, 8, 6],
    out: 0,
    top: 1,
    bottom: 2,
    bound: [0, 0, 1],
    lRule: "B + 5″, C ≤ B",
    text: "Main A straight through, cone tap B on top and cone tap C on the bottom (C up to B). L = B + 5″.",
  },
  rcc180: {
    code: "RCC180",
    name: "Reducing Conical Cross 180°",
    labels: ["A · inlet", "B · outlet", "C · top", "D · bottom"],
    defaults: [12, 10, 8, 6],
    out: 1,
    top: 2,
    bottom: 3,
    bound: [0, 0, 0, 2],
    lRule: "C + 5″, D ≤ C",
    text: "Main A in, reducer R down to outlet B on the right, cone taps C on top and D on the bottom (D up to C). L = C + 5″.",
  },
};
/** Conical tee/cross sizes, L (top tap + 5") and reducer R. */
function cteeDims(type: CteeType, sizes: readonly number[]) {
  const t = CTEES[type];
  const a = sizes[0];
  const out = sizes[t.out];
  const top = sizes[t.top];
  const bottom = t.bottom === null ? 0 : sizes[t.bottom];
  return { a, out, top, bottom, L: top + CTEE_EXTRA, R: reducerLength(a, out), reducing: t.out !== 0 };
}

/** Bullhead tee run outlets by default (B and C; the branch A defaults to 12"). */
const TEE_RUN_DEFAULT = 10;

const B = new THREE.Vector3(0, 0, 1);
const centerline = (a: number, R: number) => new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), 0);
const tangent = (a: number) => new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
const outward = (a: number) => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);

/** A straight round piece along the line O + s*T (T tangent to the centerline at angle t), from sFrom(phi) to sTo(phi). */
function piece(
  t: number,
  R: number,
  rr: number,
  sFrom: (phi: number) => number,
  sTo: (phi: number) => number,
  vBase: number,
  radial: number,
) {
  const O = centerline(t, R);
  const T = tangent(t);
  const N = outward(t);
  const rows = 6;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const s = sFrom(phi) + ((sTo(phi) - sFrom(phi)) * i) / rows;
      n.copy(N).multiplyScalar(Math.cos(phi)).addScaledVector(B, Math.sin(phi));
      p.copy(O).addScaledVector(T, s).addScaledVector(n, rr);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, (vBase + s) / TEX_LENGTH);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Where the piece tangent at t crosses the radial joint plane at angle a, for a point at radius rr, angle phi. */
const miter = (t: number, a: number, R: number, rr: number) => (phi: number) => (R + rr * Math.cos(phi)) * Math.tan(a - t);

/** Smooth bend (die-stamped): the torus section from 0 to 90°, radius rr about the centerline. */
function bend(R: number, rr: number, vBase: number, radial: number) {
  const rows = 48;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * (Math.PI / 2);
    const O = centerline(a, R);
    const N = outward(a);
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      n.copy(N).multiplyScalar(Math.cos(phi)).addScaledVector(B, Math.sin(phi));
      p.copy(O).addScaledVector(n, rr);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, (vBase + a * R) / TEX_LENGTH);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Lengthwise line along the bend at a fixed distance from the bend's centre (the heel or throat lap seam). */
class BendLine extends THREE.Curve<THREE.Vector3> {
  constructor(
    private rad: number,
    private z = 0,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const a = u * (Math.PI / 2);
    return target.set(this.rad * Math.cos(a), this.rad * Math.sin(a), this.z);
  }
}

/** Closed loop around a gore joint (the mitre ellipse), pushed out a little so the seam sits on the surface. */
class JointLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private t: number,
    private a: number,
    private R: number,
    private rr: number,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const phi = u * Math.PI * 2;
    const s = miter(this.t, this.a, this.R, this.rr)(phi);
    return target
      .copy(centerline(this.t, this.R))
      .addScaledVector(tangent(this.t), s)
      .addScaledVector(outward(this.t), this.rr * Math.cos(phi))
      .addScaledVector(B, this.rr * Math.sin(phi));
  }
}

/**
 * Mitered elbow leg (local frame: miter corner at the origin, cut plane x = y): straight round pipe along dir, its
 * circle in (perp, B), from the 45° cut (s = -rr cos phi) out to sTo.
 */
function miterLeg(dir: THREE.Vector3, perp: THREE.Vector3, rr: number, sTo: number, vBase: number, radial: number) {
  const rows = 4;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  // Wind the triangles to face out whichever way the (perp, B) circle turns about dir.
  const flip = new THREE.Vector3().crossVectors(perp, B).dot(dir) > 0;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const s0 = -rr * Math.cos(phi);
      const s = s0 + ((sTo - s0) * i) / rows;
      n.copy(perp).multiplyScalar(Math.cos(phi)).addScaledVector(B, Math.sin(phi));
      p.copy(dir).multiplyScalar(s).addScaledVector(n, rr);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, (vBase + sTo - s) / TEX_LENGTH);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The miter seam: the ellipse where the two legs meet on the cut plane x = y. */
class MiterLoop extends THREE.Curve<THREE.Vector3> {
  constructor(private rr: number) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const phi = u * Math.PI * 2;
    return target.set(this.rr * Math.cos(phi), this.rr * Math.cos(phi), this.rr * Math.sin(phi));
  }
}

/**
 * Turning vanes (MEV90), in the miter's local frame. Flow comes up leg 0 (+y) and leaves along leg 1 (-x); each vane
 * is a quarter-arc blade whose middle sits on the cut plane, leading edge along +y and trailing edge along -x, set at
 * even steps along the miter from throat to heel. Each blade spans the full width of the duct (to the round wall).
 */
function buildVanes(d: number, n: number, mat: THREE.Material, edge: THREE.Material) {
  const g = new THREE.Group();
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rin = r - wall - 0.02;
  const step = (2 * r) / (n + 1);
  const a = step * 1.05; // blade radius: chord about one vane spacing
  const H = Math.SQRT1_2;
  const half = (x: number, y: number) => {
    const c = x > y ? x : y; // which leg the point is in (leg 0: x > y)
    return Math.sqrt(Math.max(0, rin * rin - c * c));
  };
  const us = 24;
  for (let k = 0; k < n; k++) {
    const t = -r + step * (k + 1) - a * 0.1;
    const cx = t - a * H;
    const arc: [number, number][] = [];
    for (let i = 0; i <= us; i++) {
      const th = (i / us) * (Math.PI / 2);
      arc.push([cx + a * Math.cos(th), cx + a * Math.sin(th)]);
    }
    vaneBlade(g, arc, half, d, mat, edge);
  }
  return g;
}

/**
 * One vane blade: the curve arc (x, y points) swept across the duct in z, out to the round wall on each side
 * (half(x, y) = half-height there), with a dark outline tube round its edges so its shape reads.
 */
function vaneBlade(g: THREE.Group, arc: [number, number][], half: (x: number, y: number) => number, d: number, mat: THREE.Material, edge: THREE.Material) {
  const us = arc.length - 1;
  const vs = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const [x, y] of arc) {
    const h = half(x, y);
    for (let j = 0; j <= vs; j++) pos.push(x, y, -h + (2 * h * j) / vs);
  }
  for (let i = 0; i < us; i++) {
    for (let j = 0; j < vs; j++) {
      const p0 = i * (vs + 1) + j;
      const p1 = p0 + vs + 1;
      idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  // Outline the blade (curved edges along the wall, straight leading and trailing edges) so its shape reads.
  const ring: THREE.Vector3[] = [];
  const at = (i: number, j: number) => new THREE.Vector3(pos[(i * (vs + 1) + j) * 3], pos[(i * (vs + 1) + j) * 3 + 1], pos[(i * (vs + 1) + j) * 3 + 2]);
  for (let i = 0; i <= us; i++) ring.push(at(i, vs));
  for (let j = vs - 1; j >= 0; j--) ring.push(at(us, j));
  for (let i = us - 1; i >= 0; i--) ring.push(at(i, 0));
  for (let j = 1; j < vs; j++) ring.push(at(0, j));
  const path = new THREE.CatmullRomCurve3(ring, true, "centripetal");
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path, ring.length * 2, Math.max(0.05, d * 0.007), 5, true), edge));
}

/**
 * Bullhead tee splitter vanes (BTV90), in the tee's frame (body along x, branch down -y, centre at the origin). Flow
 * comes up the branch and splits both ways; on each side n quarter-arc blades turn it from up (+y) to out (+-x), set
 * at even steps from the top of the body over the branch's centre (the heel) to the branch's corner with the body's
 * bottom (the throat), mirrored left and right. Each spans the duct to the round wall.
 */
function buildTeeVanes(d: number, n: number, mat: THREE.Material, edge: THREE.Material) {
  const g = new THREE.Group();
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rin = r - wall - 0.02;
  // Inside the body (|z| <= its circle at y) or, below the body's axis and over the branch, the branch (circle at x).
  const half = (x: number, y: number) => {
    const c2 = y < 0 && Math.abs(x) < rin ? Math.min(x * x, y * y) : y * y;
    return Math.sqrt(Math.max(0, rin * rin - c2));
  };
  const sx = r / (n + 1);
  const sy = (-2 * r) / (n + 1);
  const a = Math.hypot(sx, sy) * 0.9; // blade radius: about one vane spacing
  const H = Math.SQRT1_2;
  const us = 24;
  for (const side of [1, -1]) {
    for (let k = 0; k < n; k++) {
      // the blade's middle on the heel-throat line; centre of its arc off to the outside and down
      const px = sx * (k + 1);
      const py = r + sy * (k + 1);
      const cx = px + a * H;
      const cy = py - a * H;
      const arc: [number, number][] = [];
      for (let i = 0; i <= us; i++) {
        const th = Math.PI - (i / us) * (Math.PI / 2); // from pointing down (leading edge) to pointing out
        arc.push([side * (cx + a * Math.cos(th)), cy + a * Math.sin(th)]);
      }
      vaneBlade(g, arc, half, d, mat, edge);
    }
  }
  return g;
}

type Mats = { metal: THREE.Material; inside: THREE.Material; seam: THREE.Material };

/**
 * How the elbow's ends are made, by connection (Brent):
 *   bead   None: plain 2" straight ends with a bead where each meets its end gore.
 *   crimp  Coupling (slip joint): bead, then the end is crimped past it (a little smaller, fluted) so the duct slides over it.
 *   plain  Flange: straight ends, no beads; a flange's collar goes inside the end.
 */
type EndStyle = "bead" | "crimp" | "plain";

const X_AXIS = new THREE.Vector3(1, 0, 0);
/**
 * Local frame at one open end of the elbow: origin at the end's centre, +X pointing out of the elbow along its axis
 * (so the 2" collar runs from x = -2 to 0). The duct connections are built along +X, same as on the straight duct.
 */
function endFrame(end: 0 | 1, R: number) {
  const t = end === 0 ? 0 : Math.PI / 2;
  const out = tangent(t).multiplyScalar(end === 0 ? -1 : 1);
  const g = new THREE.Group();
  g.position.copy(centerline(t, R)).addScaledVector(out, COLLAR);
  g.quaternion.setFromUnitVectors(X_AXIS, out);
  return g;
}

/** Crimped end: the bead sits BEAD_X in from the end; past it the end steps down and is fluted to the cut edge. */
const BEAD_X = -1.55;
const CRIMP_X = -1.3; // crimp starts (the duct slides on up to here, against the bead)
const CRIMP_TAPER = 0.22;

function crimpRadius(d: number) {
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rcr = r - wall - 0.05; // fits inside the duct
  const flutes = Math.max(24, Math.round((Math.PI * 2 * rcr) / 0.42));
  const cd = 0.1 + d * 0.003;
  return (x: number, a: number) => {
    if (x < CRIMP_X) return r;
    const e = Math.min(1, (x - CRIMP_X) / CRIMP_TAPER);
    const k = e * e * (3 - 2 * e);
    return r - (r - rcr) * k - cd * k * 0.5 * (1 - Math.cos(flutes * a));
  };
}

/** One end's 2" collar (outside + inside), its bead and the cut rim, in its end frame. */
function buildCollar(d: number, style: EndStyle, { metal, inside, seam }: Mats, bead: number, radial: number) {
  const g = new THREE.Group();
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const uv = 1 / TEX_LENGTH;
  if (style === "crimp") {
    const rad = crimpRadius(d);
    const xs = samples(-COLLAR, 0, (x) => x > CRIMP_X - 0.05, 0.05, 0.3);
    const segs = Math.max(24, Math.round((Math.PI * 2 * (r - wall - 0.05)) / 0.42)) * 4;
    g.add(new THREE.Mesh(shell(xs, segs, rad, uv), metal));
    g.add(new THREE.Mesh(shell(xs, segs, (x, a) => rad(x, a) - wall, uv), inside));
    const rim = new THREE.RingGeometry(r - wall - 0.05 - wall - 0.1 - d * 0.003, r - wall - 0.05, segs);
    rim.rotateY(Math.PI / 2);
    g.add(new THREE.Mesh(rim, metal));
  } else {
    const xs = [-COLLAR, 0];
    g.add(new THREE.Mesh(shell(xs, radial, () => r, uv), metal));
    g.add(new THREE.Mesh(shell(xs, radial, () => r - wall, uv), inside));
    const rim = new THREE.RingGeometry(r - wall, r + 0.005, radial);
    rim.rotateY(Math.PI / 2);
    g.add(new THREE.Mesh(rim, metal));
  }
  if (style !== "plain") {
    const t = new THREE.TorusGeometry(r + bead * 0.2, bead, 8, radial);
    t.rotateY(Math.PI / 2);
    t.translate(style === "crimp" ? BEAD_X : -COLLAR, 0, 0);
    g.add(new THREE.Mesh(t, seam));
  }
  return g;
}

/** Mitered elbow: the two legs, the seam along the cut, the collars, and (MEV90) the vanes. Same end frames as the bends. */
function buildMitered(d: number, mats: Mats, style: EndStyle, vanes: number, vaneMat: THREE.Material, vaneEdge: THREE.Material) {
  const { metal, inside, seam } = mats;
  const group = new THREE.Group();
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const radial = Math.min(144, 64 + Math.round(d * 4));
  const rib = Math.min(0.34, 0.04 + d * 0.012);
  const bead = rib * 0.8;
  // Miter corner at (R, R) so the ends sit where the bends' ends do (leg 0 down along x = R, leg 1 left along y = R).
  const R = r + MITER_LEG;
  const body = new THREE.Group();
  body.position.set(R, R, 0);
  group.add(body);
  const legs = [
    { dir: new THREE.Vector3(0, -1, 0), perp: new THREE.Vector3(1, 0, 0) },
    { dir: new THREE.Vector3(-1, 0, 0), perp: new THREE.Vector3(0, 1, 0) },
  ];
  const sTo = R - COLLAR; // body ends where the 2" collar starts
  legs.forEach(({ dir, perp }, i) => {
    body.add(new THREE.Mesh(miterLeg(dir, perp, r, sTo, COLLAR + i * 37, radial), metal));
    const inner = miterLeg(dir, perp, r - wall, sTo, COLLAR + i * 37, radial);
    body.add(new THREE.Mesh(inner, inside));
  });
  // Seam along the 45° cut (the two pieces locked together), raised a little proud of the pipe.
  body.add(new THREE.Mesh(new THREE.TubeGeometry(new MiterLoop(r + rib * 0.35), radial, rib, 8, true), seam));
  if (vanes > 0) body.add(buildVanes(d, vanes, vaneMat, vaneEdge));
  const ends = legs.map(({ dir }) => {
    const f = new THREE.Group();
    f.position.set(R, R, 0).addScaledVector(dir, R);
    f.quaternion.setFromUnitVectors(X_AXIS, dir);
    f.add(buildCollar(d, style, mats, bead, radial));
    group.add(f);
    return f;
  });
  return { group, ends };
}

/**
 * Grid surface (rows x cols vertices, row-major) with outward normals given; the triangles are wound to face along
 * those normals, whichever way the grid runs.
 */
function gridGeo(pos: number[], nor: number[], uv: number[], rows: number, cols: number) {
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + cols;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Which way the triangles face, against the given normals (summed, so degenerate ones don't matter).
  const v = (k: number) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  let facing = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const p0 = v(idx[t]);
    const c = new THREE.Vector3().crossVectors(v(idx[t + 1]).sub(p0), v(idx[t + 2]).sub(p0));
    facing += c.dot(new THREE.Vector3(nor[idx[t] * 3], nor[idx[t] * 3 + 1], nor[idx[t] * 3 + 2]));
  }
  if (facing < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Tee body (radius rr, along x from -L/2 to L/2, centre at the origin), open where the branch comes in: the branch is
 * the same size, so at the angle theta around the body (y = rr cos, z = rr sin) the bottom half is cut away for
 * |x| < rr |cos theta| (the two cylinders' intersection). Built as a left and a right strip that meet along the top.
 */
function teeBody(rr: number, L: number, radial: number) {
  const rows = 8;
  return ([-1, 1] as const).map((side) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2;
        const cy = Math.cos(th);
        const w = rr * Math.max(0, -cy);
        const x = side * (w + ((L / 2 - w) * i) / rows);
        pos.push(x, rr * cy, rr * Math.sin(th));
        nor.push(0, cy, Math.sin(th));
        uv.push(j / radial, (x + 40) / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, radial + 1);
  });
}

/** Tee branch (radius rr, down -y from where it meets the body, |x| = ... y = -rr |cos phi|, to y = -yTo). */
function teeBranch(rr: number, yTo: number, radial: number) {
  const rows = 8;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const s0 = rr * Math.abs(Math.cos(phi));
      const s = s0 + ((yTo - s0) * i) / rows;
      pos.push(rr * Math.cos(phi), -s, rr * Math.sin(phi));
      nor.push(Math.cos(phi), 0, Math.sin(phi));
      uv.push(j / radial, (11 + yTo - s) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}

/** The seam where the branch meets the body: the intersection of two equal cylinders (two ellipses crossing at the sides). */
class TeeLoop extends THREE.Curve<THREE.Vector3> {
  constructor(private rr: number) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const phi = u * Math.PI * 2;
    return target.set(this.rr * Math.cos(phi), -this.rr * Math.abs(Math.cos(phi)), this.rr * Math.sin(phi));
  }
}

/**
 * Bullhead tee (A branch and body, B left and C right outlets): body, branch and seam, the reducers and 2" ends, and
 * (BTV90) the vanes. ends[0] is the branch end (the connection goes there), then the B and C ends; +X out of each.
 */
function buildTee(a: number, b: number, c: number, mats: Mats, style: EndStyle, vanes: number, vaneMat: THREE.Material, vaneEdge: THREE.Material) {
  const { metal, inside, seam } = mats;
  const group = new THREE.Group();
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const ribOf = (d: number) => Math.min(0.34, 0.04 + d * 0.012);
  const rib = ribOf(a);
  const L = a + TEE_EXTRA;
  for (const g of teeBody(r, L, radial)) group.add(new THREE.Mesh(g, metal));
  for (const g of teeBody(r - wall, L, radial)) group.add(new THREE.Mesh(g, inside));
  const yTo = r + TEE_BRANCH - COLLAR; // branch body ends where its 2" collar starts
  group.add(new THREE.Mesh(teeBranch(r, yTo, radial), metal));
  group.add(new THREE.Mesh(teeBranch(r - wall, yTo, radial), inside));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new TeeLoop(r + rib * 0.35), radial * 2, rib, 8, true), seam));
  if (vanes > 0) group.add(buildTeeVanes(a, vanes, vaneMat, vaneEdge));
  // Branch end.
  const down = new THREE.Vector3(0, -1, 0);
  const fb = new THREE.Group();
  fb.position.set(0, -(r + TEE_BRANCH), 0);
  fb.quaternion.setFromUnitVectors(X_AXIS, down);
  fb.add(buildCollar(a, style, mats, rib * 0.8, radial));
  group.add(fb);
  const ends = [fb];
  // Run ends: reducer (concentric, A down to B or C over R), then the 2" end.
  ([
    [-1, b],
    [1, c],
  ] as const).forEach(([side, d]) => {
    const R = reducerLength(a, d);
    const rd = d / 2;
    const wd = Math.max(0.05, d * 0.006);
    const radialD = Math.min(144, 64 + Math.round(d * 4));
    const f = new THREE.Group();
    f.position.set(side * (L / 2 + R + COLLAR), 0, 0);
    f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(side, 0, 0));
    if (R > 0) {
      const x0 = -COLLAR - R;
      const k = (x: number) => (x - x0) / R;
      const xs = [x0, -COLLAR];
      f.add(new THREE.Mesh(shell(xs, radial, (x) => r + (rd - r) * k(x), 1 / TEX_LENGTH), metal));
      f.add(new THREE.Mesh(shell(xs, radial, (x) => r - wall + (rd - wd - (r - wall)) * k(x), 1 / TEX_LENGTH), inside));
      // raised seam where the reducer joins the body
      const t = new THREE.TorusGeometry(r + rib * 0.2, rib * 0.8, 8, radial);
      t.rotateY(Math.PI / 2);
      t.translate(x0, 0, 0);
      f.add(new THREE.Mesh(t, seam));
    }
    f.add(buildCollar(d, style, mats, ribOf(d) * 0.8, radialD));
    group.add(f);
    ends.push(f);
  });
  return { group, ends };
}

/**
 * Tee/cross main (radius rr, along x from -L/2 to L/2, centre at the origin), open where the taps come in: a top tap
 * of radius rt and a bottom tap of radius rb (0 = none), each no bigger than rr. At the angle theta around the main
 * (y = rr cos, z = rr sin) the hole runs |x| < sqrt(rt^2 - z^2) on the tap's side (the cylinders' intersection).
 * Built as a left and a right strip that meet where there is no hole; the angles are refined where the hole's edge
 * turns fast (near its sides), so the saddle reads round.
 */
function crossBody(rr: number, L: number, radial: number, rt: number, rb: number) {
  const half = (th: number) => {
    const c = Math.cos(th);
    const z = rr * Math.sin(th);
    const t = c > 0 ? rt : c < 0 ? rb : 0;
    return Math.sqrt(Math.max(0, t * t - z * z));
  };
  let ths = Array.from({ length: radial + 1 }, (_, j) => (j / radial) * Math.PI * 2);
  // exact hole sides, then split any step where the hole edge moves a lot
  for (const t of [rt, rb]) {
    if (t <= 0 || t >= rr) continue;
    const a = Math.asin(t / rr);
    ths.push(...(t === rt ? [a, -a + Math.PI * 2] : [Math.PI - a, Math.PI + a]));
  }
  ths.sort((p, q) => p - q);
  for (let pass = 0; pass < 6; pass++) {
    const next: number[] = [ths[0]];
    for (let j = 1; j < ths.length; j++) {
      if (Math.abs(half(ths[j]) - half(ths[j - 1])) > rr * 0.04 && ths[j] - ths[j - 1] > 1e-4) next.push((ths[j] + ths[j - 1]) / 2);
      next.push(ths[j]);
    }
    ths = next;
  }
  const rows = 8;
  const cols = ths.length;
  return ([-1, 1] as const).map((side) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (const th of ths) {
        const cy = Math.cos(th);
        const w = half(th);
        const x = side * (w + ((L / 2 - w) * i) / rows);
        pos.push(x, rr * cy, rr * Math.sin(th));
        nor.push(0, cy, Math.sin(th));
        uv.push(th / (Math.PI * 2), (x + 40) / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, cols);
  });
}

/** A tap (radius rt) out of the main (radius rr) on the dir side (+1 up, -1 down): from the saddle out to |y| = yTo. */
function crossTap(rt: number, rr: number, yTo: number, dir: 1 | -1, radial: number) {
  const rows = 8;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const z = rt * Math.sin(phi);
      const s0 = Math.sqrt(Math.max(0, rr * rr - z * z));
      const s = s0 + ((yTo - s0) * i) / rows;
      pos.push(rt * Math.cos(phi), dir * s, z);
      nor.push(Math.cos(phi), 0, Math.sin(phi));
      uv.push(j / radial, (11 + yTo - s) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}

/** The saddle seam where a tap (radius rt) meets the main (radius rr), pushed out by k so it sits on the surface. */
class SaddleLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private rt: number,
    private rr: number,
    private k: number,
    private dir: 1 | -1,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const phi = u * Math.PI * 2;
    const rp = this.rt + this.k;
    const z = rp * Math.sin(phi);
    const R = this.rr + this.k;
    return target.set(rp * Math.cos(phi), this.dir * Math.sqrt(Math.max(0, R * R - z * z)), z);
  }
}

/**
 * Run end on side (-1 left, +1 right) of a main of diameter a and body length L: a concentric reducer down to d over
 * reducerLength(a, d) (none when d = a), then the 2" end. Returns the end frame (+X out of the fitting).
 */
function runEnd(side: -1 | 1, a: number, d: number, L: number, mats: Mats, style: EndStyle) {
  const f = reducedEnd(a, d, mats, style);
  f.position.set(side * (L / 2 + reducerLength(a, d) + COLLAR), 0, 0);
  f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(side, 0, 0));
  return f;
}

/**
 * An end of size d on a body of size a, in its end frame (+X out, origin at the cut end): the concentric reducer R =
 * reducerLength(a, d) from x = -2 - R to -2 with its raised seam where it meets the body (none when d = a), then the
 * 2" end. Shared by the tees/laterals' run ends and the wye's legs.
 */
function reducedEnd(a: number, d: number, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const ribOf = (x: number) => Math.min(0.34, 0.04 + x * 0.012);
  const rib = ribOf(a);
  const R = reducerLength(a, d);
  const rd = d / 2;
  const wd = Math.max(0.05, d * 0.006);
  const radialD = Math.min(144, 64 + Math.round(d * 4));
  const f = new THREE.Group();
  if (R > 0) {
    const x0 = -COLLAR - R;
    const k = (x: number) => (x - x0) / R;
    const xs = [x0, -COLLAR];
    f.add(new THREE.Mesh(shell(xs, radial, (x) => r + (rd - r) * k(x), 1 / TEX_LENGTH), metal));
    f.add(new THREE.Mesh(shell(xs, radial, (x) => r - wall + (rd - wd - (r - wall)) * k(x), 1 / TEX_LENGTH), inside));
    // raised seam where the reducer joins the body
    const t = new THREE.TorusGeometry(r + rib * 0.2, rib * 0.8, 8, radial);
    t.rotateY(Math.PI / 2);
    t.translate(x0, 0, 0);
    f.add(new THREE.Mesh(t, seam));
  }
  f.add(buildCollar(d, style, mats, ribOf(d) * 0.8, radialD));
  return f;
}

/**
 * Tee or cross (sheet "Tees and Crosses"): the main, its taps with their saddle seams and 2" collars, the left A end
 * and the right end (reducer to the outlet on RT90 / RC180). ends[0] is the A inlet end on the left (connections go
 * there), then the right end and the taps' ends.
 */
function buildCross(type: TeeType, sizes: readonly number[], mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const { a, out, top, bottom, L } = teeDims(type, sizes);
  const group = new THREE.Group();
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const ribOf = (d: number) => Math.min(0.34, 0.04 + d * 0.012);
  const wallOf = (d: number) => Math.max(0.05, d * 0.006);
  const rt = top / 2;
  const rb = bottom / 2;
  for (const g of crossBody(r, L, radial, rt, rb)) group.add(new THREE.Mesh(g, metal));
  for (const g of crossBody(r - wall, L, radial, rt - wallOf(top), bottom ? rb - wallOf(bottom) : 0)) group.add(new THREE.Mesh(g, inside));
  const ends = [runEnd(-1, a, a, L, mats, style), runEnd(1, a, out, L, mats, style)];
  ends.forEach((f) => group.add(f));
  const yTo = r + TEE_BRANCH - COLLAR; // tap body ends where its 2" collar starts
  ([
    [1, top],
    [-1, bottom],
  ] as const).forEach(([dir, d]) => {
    if (!d) return;
    const rr = d / 2;
    const tw = wallOf(d);
    const tr = Math.min(144, 64 + Math.round(d * 4));
    group.add(new THREE.Mesh(crossTap(rr, r, yTo, dir, tr), metal));
    group.add(new THREE.Mesh(crossTap(rr - tw, r - wall, yTo, dir, tr), inside));
    const rib = ribOf(d);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new SaddleLoop(rr, r, rib * 0.35, dir), tr * 2, rib, 8, true), seam));
    const f = new THREE.Group();
    f.position.set(0, dir * (r + TEE_BRANCH), 0);
    f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, dir, 0));
    f.add(buildCollar(d, style, mats, rib * 0.8, tr));
    group.add(f);
    ends.push(f);
  });
  return { group, ends };
}

/**
 * A cone tap's shape: round (radius rt) at the collar, height yTop above the main's axis, flaring along the main as it
 * goes down: half-width ax(y) along x, rt across (z). Its outline at height y is the ellipse (ax cos, y, rt sin).
 */
type ConeTap = { rt: number; ax: (y: number) => number };
const coneTap = (rt: number, yTop: number): ConeTap => ({ rt, ax: (y) => rt + (CONE_FLARE * (yTop - y)) / CONE_H });

/**
 * Conical tee/cross main (radius rr, x from -L/2 to L/2): same as crossBody, but the hole is the cone's footprint. At
 * the angle theta around the main (y = rr cos, z = rr sin) the cone's ellipse at that height gives |x| < ax(y) *
 * sqrt(1 - z^2 / rt^2) on the tap's side.
 */
function coneBody(rr: number, L: number, radial: number, top: ConeTap | null, bottom: ConeTap | null) {
  const half = (th: number) => {
    const c = Math.cos(th);
    const z = rr * Math.sin(th);
    const t = c > 0 ? top : c < 0 ? bottom : null;
    if (!t) return 0;
    const q = 1 - (z * z) / (t.rt * t.rt);
    return q > 0 ? t.ax(rr * Math.abs(c)) * Math.sqrt(q) : 0;
  };
  let ths = Array.from({ length: radial + 1 }, (_, j) => (j / radial) * Math.PI * 2);
  for (const t of [top, bottom]) {
    if (!t || t.rt >= rr) continue;
    const a = Math.asin(t.rt / rr);
    ths.push(...(t === top ? [a, -a + Math.PI * 2] : [Math.PI - a, Math.PI + a]));
  }
  ths.sort((p, q) => p - q);
  for (let pass = 0; pass < 6; pass++) {
    const next: number[] = [ths[0]];
    for (let j = 1; j < ths.length; j++) {
      if (Math.abs(half(ths[j]) - half(ths[j - 1])) > rr * 0.04 && ths[j] - ths[j - 1] > 1e-4) next.push((ths[j] + ths[j - 1]) / 2);
      next.push(ths[j]);
    }
    ths = next;
  }
  const rows = 8;
  const cols = ths.length;
  return ([-1, 1] as const).map((side) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (const th of ths) {
        const cy = Math.cos(th);
        const w = half(th);
        const x = side * (w + ((L / 2 - w) * i) / rows);
        pos.push(x, rr * cy, rr * Math.sin(th));
        nor.push(0, cy, Math.sin(th));
        uv.push(th / (Math.PI * 2), (x + 40) / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, cols);
  });
}

/** A cone tap out of the main (radius rr) on the dir side: from where it meets the main up to |y| = yTop (collar). */
function coneTapGeo(t: ConeTap, rr: number, yTop: number, dir: 1 | -1, radial: number) {
  const rows = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const slope = -CONE_FLARE / CONE_H; // d(ax)/dy
  const n = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const z = t.rt * Math.sin(phi);
      const y0 = Math.sqrt(Math.max(0, rr * rr - z * z));
      const y = y0 + ((yTop - y0) * i) / rows;
      const ax = t.ax(y);
      const x = ax * Math.cos(phi);
      // gradient of x^2/ax(y)^2 + z^2/rt^2
      n.set(x / (ax * ax), (-x * x * slope) / (ax * ax * ax), z / (t.rt * t.rt)).normalize();
      pos.push(x, dir * y, z);
      nor.push(n.x, dir * n.y, n.z);
      uv.push(j / radial, (11 + yTop - y) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}

/** The seam where a cone tap meets the main (radius rr), pushed out by k so it sits on the surface. */
class ConeSaddleLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private t: ConeTap,
    private rr: number,
    private k: number,
    private dir: 1 | -1,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const phi = u * Math.PI * 2;
    const z0 = this.t.rt * Math.sin(phi);
    const y0 = Math.sqrt(Math.max(0, this.rr * this.rr - z0 * z0));
    const z = (this.t.rt + this.k) * Math.sin(phi);
    const R = this.rr + this.k;
    return target.set((this.t.ax(y0) + this.k) * Math.cos(phi), this.dir * Math.sqrt(Math.max(0, R * R - z * z)), z);
  }
}

/**
 * Conical tee or cross (sheet "Conical Tees and Conical Crosses"): the main, its cone taps (seam where they meet the
 * main, the cone, a seam at the collar, the 2" beaded collar), the left A end and the right end (reducer to the outlet
 * on RCT90 / RCC180). ends[0] is the A inlet end on the left (connections go there), then the right end and the taps.
 */
function buildConeCross(type: CteeType, sizes: readonly number[], mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const { a, out, top, bottom, L } = cteeDims(type, sizes);
  const group = new THREE.Group();
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const ribOf = (d: number) => Math.min(0.34, 0.04 + d * 0.012);
  const wallOf = (d: number) => Math.max(0.05, d * 0.006);
  const yTop = r + CONE_H; // cone runs from the main's wall up to the collar
  const outer = (d: number) => (d ? coneTap(d / 2, yTop) : null);
  const inner = (d: number) => (d ? coneTap(d / 2 - wallOf(d), yTop) : null);
  for (const g of coneBody(r, L, radial, outer(top), outer(bottom))) group.add(new THREE.Mesh(g, metal));
  for (const g of coneBody(r - wall, L, radial, inner(top), inner(bottom))) group.add(new THREE.Mesh(g, inside));
  const ends = [runEnd(-1, a, a, L, mats, style), runEnd(1, a, out, L, mats, style)];
  ends.forEach((f) => group.add(f));
  ([
    [1, top],
    [-1, bottom],
  ] as const).forEach(([dir, d]) => {
    if (!d) return;
    const tr = Math.min(144, 64 + Math.round(d * 4));
    const t = outer(d)!;
    group.add(new THREE.Mesh(coneTapGeo(t, r, yTop, dir, tr), metal));
    group.add(new THREE.Mesh(coneTapGeo(inner(d)!, r - wall, yTop, dir, tr), inside));
    const rib = ribOf(d);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new ConeSaddleLoop(t, r, rib * 0.35, dir), tr * 2, rib, 8, true), seam));
    // seam where the cone meets the collar
    const ring = new THREE.TorusGeometry(d / 2 + rib * 0.2, rib * 0.8, 8, tr);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, dir * yTop, 0);
    group.add(new THREE.Mesh(ring, seam));
    const f = new THREE.Group();
    f.position.set(0, dir * (yTop + COLLAR), 0);
    f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, dir, 0));
    f.add(buildCollar(d, style, mats, rib * 0.8, tr));
    group.add(f);
    ends.push(f);
  });
  return { group, ends };
}

/**
 * Laterals types (sheet "Laterals"), same fields as TEES; each "tap" is a branch at 45°. The bottom branch is limited by
 * the top one (sheet: "B > C" / "C > D"; equal is allowed here, L still follows the top branch), the rest by A.
 */
const LATS: Record<LatType, CrossSpec> = {
  l45: {
    code: "L45",
    name: "Lateral 45°",
    labels: ["A · main", "B · branch"],
    defaults: [12, 8],
    out: 0,
    top: 1,
    bottom: null,
    lRule: "B × 1.414 + 3″",
    text: "Main A straight through, branch B on top at 45°, leaning to the outlet: 2″ straight, then a 2″ beaded collar. L = B × 1.414 + 3″.",
  },
  rl45: {
    code: "RL45",
    name: "Reducing Lateral 45°",
    labels: ["A · inlet", "B · outlet", "C · branch"],
    defaults: [12, 10, 8],
    out: 1,
    top: 2,
    bottom: null,
    lRule: "C × 1.414 + 3″",
    text: "Main A in on the left, reducer R down to outlet B on the right, branch C on top at 45°. L = C × 1.414 + 3″, 2″ beaded ends.",
  },
  lc45: {
    code: "LC45",
    name: "Lateral Cross 45°",
    labels: ["A · main", "B · top", "C · bottom"],
    defaults: [12, 8, 6],
    out: 0,
    top: 1,
    bottom: 2,
    bound: [0, 0, 1],
    lRule: "B × 1.414 + 3″, C ≤ B",
    text: "Main A straight through, branch B on top and branch C on the bottom, both at 45° leaning to the outlet (C up to B). L = B × 1.414 + 3″.",
  },
  rlc45: {
    code: "RLC45",
    name: "Reducing Lateral Cross 45°",
    labels: ["A · inlet", "B · outlet", "C · top", "D · bottom"],
    defaults: [12, 10, 8, 6],
    out: 1,
    top: 2,
    bottom: 3,
    bound: [0, 0, 0, 2],
    lRule: "C × 1.414 + 3″, D ≤ C",
    text: "Main A in, reducer R down to outlet B, branches C on top and D on the bottom at 45°, leaning to the outlet (D up to C). L = C × 1.414 + 3″.",
  },
};
/** Lateral sizes, L (sheet: top branch x 1.414 + 3", rounded to the nearest 1/2" as the shop would mark it; Lx unrounded) and R. */
function latDims(type: LatType, sizes: readonly number[]) {
  const t = LATS[type];
  const a = sizes[0];
  const out = sizes[t.out];
  const top = sizes[t.top];
  const bottom = t.bottom === null ? 0 : sizes[t.bottom];
  const Lx = top * LAT_FACTOR + LAT_EXTRA;
  return { a, out, top, bottom, L: Math.round(Lx * 2) / 2, Lx, R: reducerLength(a, out), reducing: t.out !== 0 };
}

const C45 = Math.SQRT1_2;
/**
 * A 45° branch (radius rb) out of a main (radius rr): its axis runs from (xc, 0, 0) on the main's axis up and to the
 * right along (C45, C45, 0). Around the branch, phi = 0 is its upper-left (heel) side, phi = PI its lower-right side (the
 * short side, at 45° to the main), and z = rb sin(phi). s0 is how far along the axis that line meets the main's wall.
 */
const latS0 = (rb: number, rr: number, phi: number) => (Math.sqrt(Math.max(0, rr * rr - rb * rb * Math.sin(phi) ** 2)) - rb * Math.cos(phi) * C45) / C45;

/**
 * Lateral main (radius rr, x from -L/2 to L/2): open where the branches meet it, a top branch of radius rt and a bottom one
 * of radius rb (0 = none), axes through (xc, 0, 0). At the angle theta around the main (y = rr cos, z = rr sin) the hole
 * runs from xc + |y| - sqrt2 sqrt(t^2 - z^2) to xc + |y| + sqrt2 sqrt(t^2 - z^2) on the branch's side. Built as a left
 * and a right strip that meet at the hole (or, where there is none, at the hole's side point); the angles are refined
 * where the hole's edge moves fast, so the saddle reads round.
 */
function latBody(rr: number, L: number, radial: number, rt: number, rb: number, xc: number) {
  const side = (t: number) => (t > 0 ? xc + Math.sqrt(Math.max(0, rr * rr - t * t)) : NaN);
  const mt = side(rt);
  const mb = rb > 0 ? side(rb) : mt;
  const edge = (th: number): [number, number] => {
    const c = Math.cos(th);
    const z = rr * Math.sin(th);
    const t = c >= 0 ? rt : rb;
    const m = c >= 0 ? mt : mb;
    if (!(t > 0) || Math.abs(z) >= t) return [m, m];
    const h = Math.SQRT2 * Math.sqrt(t * t - z * z);
    const x = xc + rr * Math.abs(c);
    return [x - h, x + h];
  };
  let ths = Array.from({ length: radial + 1 }, (_, j) => (j / radial) * Math.PI * 2);
  for (const t of [rt, rb]) {
    if (t <= 0 || t >= rr) continue;
    const a = Math.asin(t / rr);
    ths.push(...(t === rt ? [a, -a + Math.PI * 2] : [Math.PI - a, Math.PI + a]));
  }
  ths.sort((p, q) => p - q);
  for (let pass = 0; pass < 6; pass++) {
    const next: number[] = [ths[0]];
    for (let j = 1; j < ths.length; j++) {
      const [l0, h0] = edge(ths[j - 1]);
      const [l1, h1] = edge(ths[j]);
      if (Math.max(Math.abs(l1 - l0), Math.abs(h1 - h0)) > rr * 0.04 && ths[j] - ths[j - 1] > 1e-4) next.push((ths[j] + ths[j - 1]) / 2);
      next.push(ths[j]);
    }
    ths = next;
  }
  const rows = 8;
  const cols = ths.length;
  return ([-1, 1] as const).map((s) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (const th of ths) {
        const cy = Math.cos(th);
        const w = edge(th)[s < 0 ? 0 : 1];
        const x = w + ((s * L) / 2 - w) * (i / rows);
        pos.push(x, rr * cy, rr * Math.sin(th));
        nor.push(0, cy, Math.sin(th));
        uv.push(th / (Math.PI * 2), (x + 40) / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, cols);
  });
}

/** A 45° branch (radius rb) out of the main (radius rr) on the dir side (+1 up, -1 down, mirrored): saddle to s = sTo. */
function latBranch(rb: number, rr: number, xc: number, sTo: number, dir: 1 | -1, radial: number) {
  const rows = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const s0 = latS0(rb, rr, phi);
      const s = s0 + ((sTo - s0) * i) / rows;
      const cp = Math.cos(phi);
      pos.push(xc + (s - rb * cp) * C45, dir * (s + rb * cp) * C45, rb * Math.sin(phi));
      nor.push(-cp * C45, dir * cp * C45, Math.sin(phi));
      uv.push(j / radial, (11 + sTo - s) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}

/** The saddle seam where a 45° branch (radius rb) meets the main (radius rr), pushed out by k so it sits on the surface. */
class LatSaddleLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private rb: number,
    private rr: number,
    private xc: number,
    private k: number,
    private dir: 1 | -1,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const phi = u * Math.PI * 2;
    const rp = this.rb + this.k;
    const R = this.rr + this.k;
    const z = rp * Math.sin(phi);
    const y = Math.sqrt(Math.max(0, R * R - z * z));
    return target.set(this.xc + y - Math.SQRT2 * rp * Math.cos(phi), this.dir * y, z);
  }
}

/**
 * Lateral or lateral cross (sheet "Laterals"): the main, its 45° branches leaning to the outlet (right), each with its
 * saddle seam, LAT_STRAIGHT of straight branch on its short side and the 2" beaded collar; the left A end and the right
 * end (reducer to the outlet on RL45 / RLC45). The branch axes cross the main's axis at x = -A/2, which centres each
 * branch's footprint (top branch x 1.414 long) on the body. ends[0] is the A inlet end on the left (connections go
 * there), then the right end and the branches.
 */
function buildLateral(type: LatType, sizes: readonly number[], mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const { a, out, top, bottom, L } = latDims(type, sizes);
  const group = new THREE.Group();
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const ribOf = (d: number) => Math.min(0.34, 0.04 + d * 0.012);
  const wallOf = (d: number) => Math.max(0.05, d * 0.006);
  const xc = -r;
  const rt = top / 2;
  const rb = bottom / 2;
  for (const g of latBody(r, L, radial, rt, rb, xc)) group.add(new THREE.Mesh(g, metal));
  for (const g of latBody(r - wall, L, radial, rt - wallOf(top), bottom ? rb - wallOf(bottom) : 0, xc)) group.add(new THREE.Mesh(g, inside));
  const ends = [runEnd(-1, a, a, L, mats, style), runEnd(1, a, out, L, mats, style)];
  ends.forEach((f) => group.add(f));
  ([
    [1, top],
    [-1, bottom],
  ] as const).forEach(([dir, d]) => {
    if (!d) return;
    const rr = d / 2;
    const tw = wallOf(d);
    const tr = Math.min(144, 64 + Math.round(d * 4));
    // branch body ends where its 2" collar starts: LAT_STRAIGHT past the main on its short (lower-right) side
    const sTo = latS0(rr, r, Math.PI) + LAT_STRAIGHT;
    group.add(new THREE.Mesh(latBranch(rr, r, xc, sTo, dir, tr), metal));
    group.add(new THREE.Mesh(latBranch(rr - tw, r - wall, xc, sTo, dir, tr), inside));
    const rib = ribOf(d);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new LatSaddleLoop(rr, r, xc, rib * 0.35, dir), tr * 2, rib, 8, true), seam));
    const axis = new THREE.Vector3(C45, dir * C45, 0);
    const f = new THREE.Group();
    f.position.set(xc, 0, 0).addScaledVector(axis, sTo + COLLAR);
    f.quaternion.setFromUnitVectors(X_AXIS, axis);
    f.add(buildCollar(d, style, mats, rib * 0.8, tr));
    group.add(f);
    ends.push(f);
  });
  return { group, ends };
}

/**
 * Wye and Reducing Wye (sheet 11): inlet A at the bottom, two legs at 45° each side of its centreline (90° apart). The
 * sheet dimensions every end as a 2" straight end (its ".2″" on the Y45 inlet read as 2″) and gives R by the reducer
 * drawing; RY45 is ordered A, B, C (B the left leg, C the right, each up to A). Labels are the size selects.
 */
type WyeSpec = CrossSpec & { short: string };
const WYES: Record<WyeType, WyeSpec> = {
  y45: {
    code: "Y45",
    name: "Wye 45°",
    short: "wye",
    labels: ["A · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Inlet A at the bottom, splitting into two legs at 45° each side (90° apart), all ends A with 2″ beaded ends. Gored body, centre seam between the legs.",
  },
  ry45: {
    code: "RY45",
    name: "Reducing Wye 45°",
    short: "reducing",
    labels: ["A · inlet", "B · left", "C · right"],
    defaults: [12, 10, 8],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Inlet A at the bottom, left leg B and right leg C at 45°, each with a reducer R (by the reducer table) to its 2″ beaded end. Order A, B, C.",
  },
};
/** A wye's sizes (Y45: all A) and each leg's reducer R, from the CR table (past it, assumed). */
function wyeDims(type: WyeType, sizes: readonly number[]) {
  const a = sizes[0];
  const b = type === "ry45" ? sizes[1] : a;
  const c = type === "ry45" ? sizes[2] : a;
  return { type, a, b, c, RB: reducerLength(a, b), RC: reducerLength(a, c), past: a - Math.min(b, c) > CR_TABLE_MAX };
}
/**
 * Assumed: past the body (the inlet's lowest mitre point; on a leg, the crotch) each end has WYE_STRAIGHT of straight
 * before its reducer / 2" end, as on the laterals. With it the overall proportions match the sheet's drawing (legs about
 * 0.8 A from the junction to the end, inlet about 0.5 A).
 */
const WYE_STRAIGHT = 2;
const T22 = Math.tan(Math.PI / 8);

/**
 * Wye leg (radius rr) on the side sd (+1 right, -1 left): axis b = (sd C45, C45, 0) out of the junction O at the origin.
 * Around it, phi = 0 is the crotch side (towards the other leg), p = (-sd C45, C45, 0), z = rr sin(phi). It starts at the
 * mitre with the inlet (t1, outer half) or the centre plane x = 0 (t2, crotch half), whichever is further out, and runs
 * to t = tEnd.
 */
const wyeT0 = (rr: number, phi: number) => {
  const cp = Math.cos(phi);
  return Math.max((-rr * C45 * cp) / (1 + C45), rr * cp);
};
function wyeLeg(rr: number, tEnd: number, sd: 1 | -1, radial: number) {
  const rows = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const t0 = wyeT0(rr, phi);
      const t = t0 + ((tEnd - t0) * i) / rows;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const nx = -sd * C45 * cp;
      const ny = C45 * cp;
      pos.push(sd * C45 * t + rr * nx, C45 * t + rr * ny, rr * sp);
      nor.push(nx, ny, sp);
      uv.push(j / radial, (11 + tEnd - t) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}
/** Wye inlet (radius rr) along y, from yBot up to the two mitres: y = -|x| tan 22.5° (the pentagon's top edges). */
function wyeInlet(rr: number, yBot: number, radial: number) {
  const rows = 8;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const x = rr * Math.cos(th);
      const z = rr * Math.sin(th);
      const yTop = -Math.abs(x) * T22;
      const y = yBot + ((yTop - yBot) * i) / rows;
      pos.push(x, y, z);
      nor.push(Math.cos(th), 0, Math.sin(th));
      uv.push(j / radial, (y + 40) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}

/**
 * Wye or reducing wye (sheet 11), made like a gored fitting: the inlet A (a cylinder mitred at 22.5° each side, so the
 * front reads as the sheet's pentagon), two A-size legs at 45° mitred onto it and onto each other along the centre plane
 * (the centre seam from the junction up to the crotch), WYE_STRAIGHT of leg past the crotch, then on RY45 the reducer R
 * to B / C, and every end's 2" collar. ends: [inlet A, left leg B, right leg C].
 */
function buildWye(type: WyeType, sizes: readonly number[], mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const { a, b, c } = wyeDims(type, sizes);
  const group = new THREE.Group();
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const rib = Math.min(0.34, 0.04 + a * 0.012);
  const yBot = -(r * T22 + WYE_STRAIGHT);
  group.add(new THREE.Mesh(wyeInlet(r, yBot, radial), metal));
  group.add(new THREE.Mesh(wyeInlet(r - wall, yBot, radial), inside));
  const tEnd = r + WYE_STRAIGHT;
  const kr = r + rib * 0.35; // seams sit a little proud of the surface
  const seamTube = (f: (u: number, v: THREE.Vector3) => THREE.Vector3) =>
    new THREE.Mesh(new THREE.TubeGeometry(new FnCurve(f), radial, rib, 8, false), seam);
  // centre seam: the half-ellipse on x = 0 from the front, over the crotch, to the back
  group.add(seamTube((u, v) => {
    const phi = -Math.PI / 2 + u * Math.PI;
    return v.set(0, Math.SQRT2 * kr * Math.cos(phi), kr * Math.sin(phi));
  }));
  const inlet = new THREE.Group();
  inlet.position.set(0, yBot - COLLAR, 0);
  inlet.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, -1, 0));
  inlet.add(buildCollar(a, style, mats, rib * 0.8, radial));
  group.add(inlet);
  const ends: THREE.Group[] = [inlet];
  ([
    [-1, b],
    [1, c],
  ] as const).forEach(([sd, d]) => {
    group.add(new THREE.Mesh(wyeLeg(r, tEnd, sd, radial), metal));
    group.add(new THREE.Mesh(wyeLeg(r - wall, tEnd, sd, radial), inside));
    // mitre seam with the inlet, round the leg's outer half
    group.add(seamTube((u, v) => {
      const phi = Math.PI / 2 + u * Math.PI;
      const cp = Math.cos(phi);
      const t = (-kr * C45 * cp) / (1 + C45);
      return v.set(sd * C45 * (t - kr * cp), C45 * (t + kr * cp), kr * Math.sin(phi));
    }));
    const axis = new THREE.Vector3(sd * C45, C45, 0);
    const f = reducedEnd(a, d, mats, style);
    f.position.copy(axis).multiplyScalar(tEnd + reducerLength(a, d) + COLLAR);
    f.quaternion.setFromUnitVectors(X_AXIS, axis);
    group.add(f);
    ends.push(f);
  });
  return { group, ends, sizes: [a, b, c] };
}

/**
 * Offset and Square-to-Round Transition (sheet 12). OS is ordered A and the OFFSET (the centreline shift, 1" up to A
 * here, assumed); SQ2RD is ordered H x W (the rectangular end) and the round A, A no bigger than the smaller of H and W.
 * Labels are the size selects.
 */
type OsSpec = CrossSpec & { short: string };
const OSS: Record<OsType, OsSpec> = {
  os: {
    code: "OS",
    name: "Offset",
    short: "offset",
    labels: ["A · size", "Offset"],
    defaults: [12, 6],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "A × 2",
    text: "Round A both ends with 2″ beaded ends. A straight angled middle, mitred at both ends, shifts the centreline by the OFFSET. L = A × 2, between the 2″ ends (overall L + 4″).",
  },
  sq2rd: {
    code: "SQ2RD",
    name: "Square to Round",
    short: "sq → round",
    labels: ["H · height", "W · width", "A · round"],
    defaults: [12, 20, 10],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Rectangular H × W end (plain 2″ collar) to round A (2″ beaded end), corners fanned out in flat triangles as drawn. L by the table, whose “A” is the larger of H or W minus the round A, not the round size.",
  },
};
/** Rectangular end sizes for SQ2RD (assumed: 4" to 48" in 2" steps). */
const RECT_SIZES = Array.from({ length: 23 }, (_, i) => 4 + i * 2);
/**
 * SQ2RD length by the sheet's table, on its "A" = the larger of H or W minus the round A: 3-8" -> 12, 9-14 -> 18,
 * 15-26 -> 24, 27+ -> 36. Below 3" (not on the table) assumed 12.
 */
function sq2rdL(diff: number) {
  return { L: diff <= 8 ? 12 : diff <= 14 ? 18 : diff <= 26 ? 24 : 36, assumed: diff < 3 };
}
/** An OS / SQ2RD's sizes, L, and the size its gauge goes by (OS: A; SQ2RD: the larger of H and W). */
function osDims(type: OsType, sizes: readonly number[]) {
  if (type === "os") {
    const a = sizes[0];
    return { type, a, offset: sizes[1] ?? 0, h: 0, w: 0, L: 2 * a, diff: 0, assumed: false, gaugeD: a };
  }
  const [h, w, a] = sizes;
  const diff = Math.max(h, w) - a;
  return { type, a, offset: 0, h, w, diff, ...sq2rdL(diff), gaugeD: Math.max(h, w) };
}

/**
 * Offset (sheet 12), along x: the left 2" end (A) ends at x = 0, the right one starts at x = L, OFFSET higher. In
 * between, a straight piece from each end to a mitre and a straight angled middle. Assumed: the mitres' centres sit A / 2
 * in from each end (the drawing's proportions), so the middle runs L - A along x; both mitres bisect their bend, so on
 * the side view both cut lines lean the same way, as drawn. ends: [left, right].
 */
function buildOffset(a: number, offset: number, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const group = new THREE.Group();
  const r = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const rib = Math.min(0.34, 0.04 + a * 0.012);
  const L = 2 * a;
  const s = r;
  const p1 = new THREE.Vector3(s, 0, 0);
  const p2 = new THREE.Vector3(L - s, offset, 0);
  const lm = p1.distanceTo(p2);
  const m = p2.clone().sub(p1).normalize();
  const u = new THREE.Vector3(-m.y, m.x, 0); // the middle's "up" around its axis
  const n = m.clone().add(X_AXIS).normalize(); // both mitre planes' normal (the bend's bisector)
  const cutX = (rr: number, cp: number) => (-n.y * rr * cp) / n.x; // straight piece: x of the cut, from the mitre centre
  const cutT = (rr: number, cp: number) => (-rr * cp * n.dot(u)) / n.dot(m); // middle: same, along its axis
  const rows = 6;
  const straight = (rr: number, side: 0 | 1) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const xa = side === 0 ? 0 : L - s + cutX(rr, cp);
        const xb = side === 0 ? s + cutX(rr, cp) : L;
        const x = xa + ((xb - xa) * i) / rows;
        pos.push(x, (side ? offset : 0) + rr * cp, rr * sp);
        nor.push(0, cp, sp);
        uv.push(j / radial, x / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, radial + 1);
  };
  const middle = (rr: number) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const t0 = cutT(rr, cp);
        const t = t0 + (lm * i) / rows;
        const nx = u.x * cp;
        const ny = u.y * cp;
        const p = p1.clone().addScaledVector(m, t);
        pos.push(p.x + rr * nx, p.y + rr * ny, rr * sp);
        nor.push(nx, ny, sp);
        uv.push(j / radial, p.x / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, radial + 1);
  };
  for (const [rr, mat] of [
    [r, metal],
    [r - wall, inside],
  ] as const) {
    group.add(new THREE.Mesh(straight(rr, 0), mat));
    group.add(new THREE.Mesh(middle(rr), mat));
    group.add(new THREE.Mesh(straight(rr, 1), mat));
  }
  // the two mitre seams (ellipses on the cut planes), a little proud of the surface
  const kr = r + rib * 0.35;
  for (const c of [p1, p2]) {
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new FnCurve((t, v) => {
            const phi = t * Math.PI * 2;
            const cp = Math.cos(phi);
            return v.set(c.x + cutX(kr, cp), c.y + kr * cp, kr * Math.sin(phi));
          }),
          radial,
          rib,
          8,
          true,
        ),
        seam,
      ),
    );
  }
  const ends: THREE.Group[] = [];
  ([
    [-1, new THREE.Vector3(-COLLAR, 0, 0)],
    [1, new THREE.Vector3(L + COLLAR, offset, 0)],
  ] as const).forEach(([sd, at]) => {
    const f = new THREE.Group();
    f.position.copy(at);
    f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(sd, 0, 0));
    f.add(buildCollar(a, style, mats, rib * 0.8, radial));
    group.add(f);
    ends.push(f);
  });
  return { group, ends, sizes: [a, a] };
}

/** SQ2RD fan: how many flat triangles each rectangle corner fans out to over its quarter of the round end. */
const SQ_FAN = 8;
/**
 * Square-to-round surface (rectangle h x w at x = 0, y up h, z across w; circle radius rr at x = L), as the flat
 * triangles it is laid out from: each corner fans to its quarter of the round end, and a flat triangle on each side
 * runs from the side's two corners to the round end's point square to that side's middle. Flat shaded (facets read as
 * the drawing's fan lines).
 */
function sq2rdGeo(h: number, w: number, rr: number, L: number) {
  const N = SQ_FAN * 4;
  const ring = (k: number) => {
    const al = (k / N) * Math.PI * 2; // 0 at the top (+y), then towards +z
    return new THREE.Vector3(L, rr * Math.cos(al), rr * Math.sin(al));
  };
  const corners = [
    new THREE.Vector3(0, h / 2, w / 2),
    new THREE.Vector3(0, -h / 2, w / 2),
    new THREE.Vector3(0, -h / 2, -w / 2),
    new THREE.Vector3(0, h / 2, -w / 2),
  ];
  const tris: THREE.Vector3[][] = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < SQ_FAN; k++) tris.push([corners[q], ring(q * SQ_FAN + k), ring(q * SQ_FAN + k + 1)]);
    tris.push([corners[q], corners[(q + 1) % 4], ring(((q + 1) * SQ_FAN) % N)]);
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (const t of tris) {
    let [p0, p1, p2] = t;
    const c = p0.clone().add(p1).add(p2).divideScalar(3);
    let nn = new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0)).normalize();
    if (nn.dot(new THREE.Vector3(0, c.y, c.z)) < 0) {
      [p1, p2] = [p2, p1];
      nn = nn.negate();
    }
    for (const p of [p0, p1, p2]) {
      pos.push(p.x, p.y, p.z);
      nor.push(nn.x, nn.y, nn.z);
      uv.push((Math.atan2(p.z, p.y) / (Math.PI * 2) + 1) % 1, p.x / TEX_LENGTH);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** A rectangular tube (h x w) from x = x0 to x1, four flat sides, normals out. */
function rectTube(h: number, w: number, x0: number, x1: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, nn: THREE.Vector3) => {
    const pts = [a.clone().setX(x0), b.clone().setX(x0), b.clone().setX(x1), a.clone().setX(x0), b.clone().setX(x1), a.clone().setX(x1)];
    // wind so the face points along nn
    const cr = new THREE.Vector3().crossVectors(pts[1].clone().sub(pts[0]), pts[2].clone().sub(pts[0]));
    if (cr.dot(nn) < 0) {
      [pts[1], pts[2]] = [pts[2], pts[1]];
      [pts[4], pts[5]] = [pts[5], pts[4]];
    }
    for (const p of pts) {
      pos.push(p.x, p.y, p.z);
      nor.push(nn.x, nn.y, nn.z);
      uv.push((p.y + p.z) / TEX_LENGTH + 0.5, p.x / TEX_LENGTH);
    }
  };
  const c = (y: number, z: number) => new THREE.Vector3(0, y, z);
  quad(c(h / 2, -w / 2), c(h / 2, w / 2), new THREE.Vector3(0, 1, 0));
  quad(c(-h / 2, -w / 2), c(-h / 2, w / 2), new THREE.Vector3(0, -1, 0));
  quad(c(-h / 2, w / 2), c(h / 2, w / 2), new THREE.Vector3(0, 0, 1));
  quad(c(-h / 2, -w / 2), c(h / 2, -w / 2), new THREE.Vector3(0, 0, -1));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/**
 * Square to round transition (sheet 12), along x: the rectangular H x W end's plain 2" collar from x = -2 to 0 (the
 * drawing's bar on that end, the same width as the round 2" end; assumed a plain straight collar, no connection shown on
 * it), the faceted transition over L, then the round A's 2" end from L to L + 2. ends: [round A end] (connections go
 * there only).
 */
function buildSq2rd(h: number, w: number, a: number, L: number, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const group = new THREE.Group();
  const r = a / 2;
  const big = Math.max(h, w);
  const wall = Math.max(0.05, big * 0.006);
  const wallA = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const ribA = Math.min(0.34, 0.04 + a * 0.012);
  const rib = Math.min(0.34, 0.04 + big * 0.012);
  group.add(new THREE.Mesh(sq2rdGeo(h, w, r, L), metal));
  group.add(new THREE.Mesh(sq2rdGeo(h - 2 * wall, w - 2 * wall, r - wallA, L), inside));
  group.add(new THREE.Mesh(rectTube(h, w, -COLLAR, 0), metal));
  group.add(new THREE.Mesh(rectTube(h - 2 * wall, w - 2 * wall, -COLLAR, 0), inside));
  // the rectangular end's cut rim
  const rimShape = new THREE.Shape([
    new THREE.Vector2(-w / 2, -h / 2),
    new THREE.Vector2(w / 2, -h / 2),
    new THREE.Vector2(w / 2, h / 2),
    new THREE.Vector2(-w / 2, h / 2),
  ]);
  rimShape.holes.push(
    new THREE.Path([
      new THREE.Vector2(-w / 2 + wall, -h / 2 + wall),
      new THREE.Vector2(-w / 2 + wall, h / 2 - wall),
      new THREE.Vector2(w / 2 - wall, h / 2 - wall),
      new THREE.Vector2(w / 2 - wall, -h / 2 + wall),
    ]),
  );
  const rim = new THREE.ShapeGeometry(rimShape);
  rim.rotateY(-Math.PI / 2); // shape x -> z... facing -x (out of the rectangular end)
  rim.translate(-COLLAR, 0, 0);
  group.add(new THREE.Mesh(rim, metal));
  // seam where the transition meets the rectangular collar: round its four sides, a little proud
  const k = rib * 0.35;
  const hh = h / 2 + k;
  const ww = w / 2 + k;
  const per = 2 * (hh + ww);
  group.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new FnCurve((t, v) => {
          let d = (t % 1) * per * 2;
          if (d < 2 * ww) return v.set(0, hh, -ww + d);
          d -= 2 * ww;
          if (d < 2 * hh) return v.set(0, hh - d, ww);
          d -= 2 * hh;
          if (d < 2 * ww) return v.set(0, -hh, ww - d);
          d -= 2 * ww;
          return v.set(0, -hh + d, -ww);
        }),
        256,
        rib * 0.8,
        6,
        true,
      ),
      seam,
    ),
  );
  // and where it meets the round end
  const t = new THREE.TorusGeometry(r + ribA * 0.2, ribA * 0.8, 8, radial);
  t.rotateY(Math.PI / 2);
  t.translate(L, 0, 0);
  group.add(new THREE.Mesh(t, seam));
  const f = new THREE.Group();
  f.position.set(L + COLLAR, 0, 0);
  f.add(buildCollar(a, style, mats, ribA * 0.8, radial));
  group.add(f);
  return { group, ends: [f], sizes: [a] };
}

/** OS or SQ2RD by type (sheet 12). */
function buildOs(type: OsType, sizes: readonly number[], mats: Mats, style: EndStyle) {
  const o = osDims(type, sizes);
  return type === "os" ? buildOffset(o.a, o.offset, mats, style) : buildSq2rd(o.h, o.w, o.a, o.L, mats, style);
}

/**
 * Straight and Conical Taps types (sheet "Straight and Conical Taps"), ordered by the tap A and the pipe P it goes on.
 * Same fields as TEES (labels/defaults drive the size selects: A first, then P); top/out/bottom are unused. short is the
 * picker's second line (the sheet calls both conical ones "CT90"). gap: A is limited to P - gap. Assumed: a saddle plate
 * reaching 1" past the collar has to stay on the pipe's top half, and a cone's footprint gets odd when it reaches the
 * pipe's sides, so saddles and cones go up to A = P - 2"; the straight ST90 can be full size (A = P), like a T90's tap.
 */
type TapSpec = CrossSpec & { short: string; saddle: boolean; cone: boolean; gap: number; install: string };
const TAPS: Record<TapType, TapSpec> = {
  sst90: {
    code: "SST90",
    name: "Straight Saddle Tap 90°",
    short: "saddle",
    labels: ["A · tap", "P · pipe"],
    defaults: [8, 14],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    saddle: true,
    cone: false,
    gap: 2,
    install: "field installed",
    text: "Straight collar A, 5″ tall with a 2″ beaded end, cut to the pipe and set on a saddle plate (1″ past the collar). Pipe P shown for reference, not included.",
  },
  ct90s: {
    code: "CT90",
    name: "Conical Saddle Tap 90°",
    short: "saddle",
    labels: ["A · tap", "P · pipe"],
    defaults: [8, 14],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    saddle: true,
    cone: true,
    gap: 2,
    install: "field installed",
    text: "2″ beaded collar A, then a 3″ cone flaring to A + 2″ along the pipe, on a saddle plate (1″ past the cone). Pipe P shown for reference, not included.",
  },
  st90: {
    code: "ST90",
    name: "Straight Tap 90°",
    short: "tap",
    labels: ["A · tap", "P · pipe"],
    defaults: [8, 14],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    saddle: false,
    cone: false,
    gap: 0,
    install: "factory or field",
    text: "Straight collar A, 5″ tall with a 2″ beaded end, bottom cut to the pipe's curve. Saddle not included. Pipe P shown for reference, not included.",
  },
  ct90: {
    code: "CT90",
    name: "Conical Tap 90°",
    short: "tap",
    labels: ["A · tap", "P · pipe"],
    defaults: [8, 14],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    saddle: false,
    cone: true,
    gap: 2,
    install: "factory or field",
    text: "2″ beaded collar A, then a 3″ cone flaring to A + 2″ along the pipe, bottom cut to its curve. Saddle not included. Pipe P shown for reference, not included.",
  },
};
/** A tap's sizes: tap A, pipe P, the cone's base along the pipe (A when straight) and the saddle plate's size. */
function tapDims(type: TapType, sizes: readonly number[]) {
  const t = TAPS[type];
  const a = sizes[0];
  const p = sizes[1];
  const base = t.cone ? a + 2 * TAP_FLARE : a;
  return { a, p, base, saddle: t.saddle, cone: t.cone, plate: t.saddle ? [base + 2 * TAP_SADDLE, a + 2 * TAP_SADDLE] : null };
}

/**
 * A tap's shape over a pipe (axis along x): round (radius rt) at the collar, flaring along the pipe by TAP_FLARE over
 * TAP_CONE_H below the collar when conical: half-width ax(y) along x, rt across (z); slope = d(ax)/dy.
 */
type TapShape = { rt: number; ax: (y: number) => number; slope: number };
const tapShape = (rt: number, yTop: number, cone: boolean): TapShape =>
  cone ? { rt, ax: (y) => rt + (TAP_FLARE * (yTop - y)) / TAP_CONE_H, slope: -TAP_FLARE / TAP_CONE_H } : { rt, ax: () => rt, slope: 0 };

/** The tap's wall from where it meets a cylinder of radius rr (the pipe, or the saddle plate's top) up to y = yTop. */
function tapWall(t: TapShape, rr: number, yTop: number, radial: number) {
  const rows = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const n = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const z = t.rt * Math.sin(phi);
      const y0 = Math.sqrt(Math.max(0, rr * rr - z * z));
      const y = y0 + ((yTop - y0) * i) / rows;
      const ax = t.ax(y);
      const x = ax * Math.cos(phi);
      n.set(x / (ax * ax), (-x * x * t.slope) / (ax * ax * ax), z / (t.rt * t.rt)).normalize();
      pos.push(x, y, z);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, (11 + yTop - y) / TEX_LENGTH);
    }
  }
  return gridGeo(pos, nor, uv, rows + 1, radial + 1);
}

/** A closed curve from a function of u in [0, 1]. */
class FnCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private f: (u: number, target: THREE.Vector3) => THREE.Vector3) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    return this.f(u, target);
  }
}

/**
 * Saddle plate on a pipe of radius rp: a thin curved plate (thickness th) wrapped on the pipe's top, from the tap's
 * footprint (half-widths fx along the pipe, fz across, an ellipse) out TAP_SADDLE all round. Top, underside, outer and
 * inner edges, as plan-view ellipses laid onto the pipe.
 */
function saddlePlate(rp: number, th: number, foot: (phi: number) => [number, number], radial: number, outer?: (phi: number) => [number, number]) {
  const rows = 6;
  // outer edge: TAP_SADDLE past the footprint all round, unless given (lateral taps: the plate's own outline)
  const outerFoot =
    outer ??
    ((phi: number): [number, number] => {
      const [x, z] = foot(phi);
      return [x + TAP_SADDLE * Math.cos(phi), z + TAP_SADDLE * Math.sin(phi)];
    });
  const onPipe = (x: number, z: number, R: number) => {
    const zz = Math.max(-R * 0.999, Math.min(R * 0.999, z));
    return [x, Math.sqrt(R * R - zz * zz), zz] as const;
  };
  const surface = (R: number, up: boolean) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        const [x0, z0] = foot(phi);
        const [x1, z1] = outerFoot(phi);
        const k = i / rows;
        const [x, y, z] = onPipe(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, R);
        pos.push(x, y, z);
        const s = up ? 1 : -1;
        nor.push(0, (s * y) / R, (s * z) / R);
        uv.push((x + 40) / TEX_LENGTH, (z + 40) / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, radial + 1);
  };
  const edge = (fp: (phi: number) => [number, number], out: 1 | -1) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (const R of [rp + 0.01, rp + th]) {
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        const [fx, fz] = fp(phi);
        const [x, y, z] = onPipe(fx, fz, R);
        pos.push(x, y, z);
        nor.push(out * Math.cos(phi), 0, out * Math.sin(phi));
        uv.push(j / radial, R / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, 2, radial + 1);
  };
  return {
    geos: [surface(rp + th, true), surface(rp + 0.01, false), edge(outerFoot, 1), edge(foot, -1)],
    rim: new FnCurve((u, target) => {
      const phi = u * Math.PI * 2;
      const [x, y, z] = onPipe(...outerFoot(phi), rp + th * 0.5);
      return target.set(x, y, z);
    }),
  };
}

/**
 * Straight or conical tap (sheet "Straight and Conical Taps") on a pipe P along x: the tap only, 5" tall above the pipe's
 * top line (TAP_H, the 2" beaded collar included); its bottom is cut to the pipe's curve (or the saddle plate's), with a
 * seam where it meets; SST90 / CT90 saddle taps sit on a saddle plate. The pipe P is a see-through ghost (reference, not
 * part of the fitting). ends[0] is the tap's top (A) end (connections go there).
 */
function buildTap(type: TapType, sizes: readonly number[], mats: Mats, style: EndStyle, ref: PipeMats, plateMat: THREE.Material) {
  const { metal, inside, seam } = mats;
  const { a, p, saddle, cone } = tapDims(type, sizes);
  const group = new THREE.Group();
  const rp = p / 2;
  const rt = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const rib = Math.min(0.34, 0.04 + a * 0.012);
  const th = saddle ? Math.max(0.08, wall * 1.4) : 0;
  const yTop = rp + TAP_H - COLLAR; // tap body ends where its 2" collar starts
  const rr = rp + th; // the tap meets the plate's top (or the pipe)
  const outer = tapShape(rt, yTop, cone);
  const inner: TapShape = { rt: rt - wall, ax: (y) => outer.ax(y) - wall, slope: outer.slope };
  group.add(new THREE.Mesh(tapWall(outer, rr, yTop, radial), metal));
  group.add(new THREE.Mesh(tapWall(inner, rr, yTop, radial), inside));
  // seam where the tap meets the plate / pipe (a cone tap: like ConeSaddleLoop, pushed out by k)
  const k = rib * 0.35;
  group.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new FnCurve((u, target) => {
          const phi = u * Math.PI * 2;
          const z0 = rt * Math.sin(phi);
          const y0 = Math.sqrt(Math.max(0, rr * rr - z0 * z0));
          const z = (rt + k) * Math.sin(phi);
          const R = rr + k;
          return target.set((outer.ax(y0) + k) * Math.cos(phi), Math.sqrt(Math.max(0, R * R - z * z)), z);
        }),
        radial * 2,
        rib,
        8,
        true,
      ),
      seam,
    ),
  );
  if (cone) {
    // seam where the cone meets the collar
    const ring = new THREE.TorusGeometry(rt + rib * 0.2, rib * 0.8, 8, radial);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, yTop, 0);
    group.add(new THREE.Mesh(ring, seam));
  }
  if (saddle) {
    const foot = (phi: number): [number, number] => {
      const z = rt * Math.sin(phi);
      const y0 = Math.sqrt(Math.max(0, rr * rr - z * z));
      return [outer.ax(y0) * Math.cos(phi), z];
    };
    const plate = saddlePlate(rp, th, foot, radial);
    for (const g of plate.geos) group.add(new THREE.Mesh(g, plateMat));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(plate.rim, radial * 2, th * 0.75, 6, true), seam));
  }
  const f = new THREE.Group();
  f.position.set(0, rp + TAP_H, 0);
  f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, 1, 0));
  f.add(buildCollar(a, style, mats, rib * 0.8, radial));
  group.add(f);
  // The pipe P: a short see-through length, for reference only.
  let span = 0;
  for (let j = 0; j <= 90; j++) {
    const phi = (j / 90) * (Math.PI / 2);
    const z = rt * Math.sin(phi);
    span = Math.max(span, 2 * (outer.ax(Math.sqrt(Math.max(0, rr * rr - z * z))) * Math.cos(phi) + (saddle ? TAP_SADDLE * Math.cos(phi) : 0)));
  }
  const ghost = buildPipe(p, ref, Math.max(p + 4, Math.ceil(span) + 8));
  ghost.traverse((o) => {
    o.renderOrder = 1;
  });
  group.add(ghost);
  return { group, ends: [f] };
}

/**
 * Lateral Taps types (sheet "Lateral Taps"), ordered by the tap A and the pipe P; same fields as TAPS (cone unused).
 * The sheet's L rule says "C", which these have no size for: read as A. A lateral saddle tap's plate has to stay on the
 * pipe's top half (A up to P - 2"); the LT45 can be full size (A = P), like a lateral's branch.
 */
const LTAPS: Record<LtapType, TapSpec> = {
  lst45: {
    code: "LST45",
    name: "Lateral Saddle Tap 45°",
    short: "saddle",
    labels: ["A · tap", "P · pipe"],
    defaults: [8, 14],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "A × 1.414 + 3″",
    saddle: true,
    cone: false,
    gap: 2,
    install: "field installed",
    text: "Branch A at 45°, leaning like the Laterals: 2″ straight, then a 2″ beaded collar, cut to the pipe on a saddle plate L long. L = A × 1.414 + 3″. Pipe P shown for reference, not included.",
  },
  lt45: {
    code: "LT45",
    name: "Lateral Tap 45°",
    short: "tap",
    labels: ["A · tap", "P · pipe"],
    defaults: [8, 14],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "A × 1.414",
    saddle: false,
    cone: false,
    gap: 0,
    install: "factory or field",
    text: "Branch A at 45°: 2″ straight, then a 2″ beaded collar, bottom cut to the pipe's curve; its footprint L = A × 1.414. Saddle not included. Pipe P shown for reference, not included.",
  },
};
/** A lateral tap's sizes and L (rounded to the nearest 1/2" as the shop would mark it; Lx unrounded). */
function ltapDims(type: LtapType, sizes: readonly number[]) {
  const t = LTAPS[type];
  const a = sizes[0];
  const p = sizes[1];
  const Lx = a * LAT_FACTOR + (t.saddle ? LTAP_EXTRA : 0);
  return { a, p, saddle: t.saddle, L: Math.round(Lx * 2) / 2, Lx };
}

/**
 * Lateral tap (sheet "Lateral Taps") on a pipe P along x: a 45° branch A leaning right like the Laterals (LAT_STRAIGHT on
 * its short side, then the 2" beaded collar), cut to the pipe's curve (or the saddle plate's) with its seam; LST45 sits
 * on a saddle plate L long along the pipe (centred on the branch's footprint) and TAP_SADDLE past it across. The pipe P
 * is a see-through ghost. ends[0] is the tap's A end (connections go there).
 */
function buildLateralTap(type: LtapType, sizes: readonly number[], mats: Mats, style: EndStyle, ref: PipeMats, plateMat: THREE.Material) {
  const { metal, inside, seam } = mats;
  const { a, p, saddle, L } = ltapDims(type, sizes);
  const group = new THREE.Group();
  const rp = p / 2;
  const rb = a / 2;
  const wall = Math.max(0.05, a * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const rib = Math.min(0.34, 0.04 + a * 0.012);
  const th = saddle ? Math.max(0.08, wall * 1.4) : 0;
  const rr = rp + th; // the branch meets the plate's top (or the pipe)
  const xc = -rr; // the branch's axis crosses the pipe's axis here, so its footprint is centred on x = 0
  const sTo = latS0(rb, rr, Math.PI) + LAT_STRAIGHT;
  group.add(new THREE.Mesh(latBranch(rb, rr, xc, sTo, 1, radial), metal));
  group.add(new THREE.Mesh(latBranch(rb - wall, rr, xc, sTo, 1, radial), inside));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new LatSaddleLoop(rb, rr, xc, rib * 0.35, 1), radial * 2, rib, 8, true), seam));
  if (saddle) {
    const foot = (phi: number): [number, number] => {
      const z = rb * Math.sin(phi);
      return [xc + Math.sqrt(Math.max(0, rr * rr - z * z)) - Math.SQRT2 * rb * Math.cos(phi), z];
    };
    // plate outline: a rounded rectangle (superellipse) L long, TAP_SADDLE past the branch across; phi = 0 at the heel
    const sp = (t: number) => Math.sign(t) * Math.sqrt(Math.abs(t));
    const hw = rb + TAP_SADDLE;
    const outline = (phi: number): [number, number] => [-(L / 2) * sp(Math.cos(phi)), hw * sp(Math.sin(phi))];
    const plate = saddlePlate(rp, th, foot, radial * 2, outline);
    for (const g of plate.geos) group.add(new THREE.Mesh(g, plateMat));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(plate.rim, radial * 3, th * 0.75, 6, true), seam));
  }
  const axis = new THREE.Vector3(C45, C45, 0);
  const f = new THREE.Group();
  f.position.set(xc, 0, 0).addScaledVector(axis, sTo + COLLAR);
  f.quaternion.setFromUnitVectors(X_AXIS, axis);
  f.add(buildCollar(a, style, mats, rib * 0.8, radial));
  group.add(f);
  // The pipe P: a short see-through length, for reference only.
  const span = Math.max(saddle ? L : a * LAT_FACTOR, 2 * (f.position.x + rb * C45));
  const ghost = buildPipe(p, ref, Math.max(p + 4, Math.ceil(span) + 8));
  ghost.traverse((o) => {
    o.renderOrder = 1;
  });
  group.add(ghost);
  return { group, ends: [f] };
}

/** Reducer types (sheet "Concentric and Eccentric Reducer"): A (large) then B (small, below A). */
type RedSpec = CrossSpec & { short: string; ecc: boolean; rRule: string };
const REDS: Record<RedType, RedSpec> = {
  cr: {
    code: "CR",
    name: "Concentric Reducer",
    short: "concentric",
    labels: ["A · large", "B · small"],
    defaults: [12, 8],
    out: 1,
    top: 0,
    bottom: null,
    lRule: "",
    rRule: "",
    ecc: false,
    text: "Large end A (2″ beaded end), a cone R long centred on it, then small end B (2″ beaded end). R by the reduction A − B: 1–4″ 4″, 5–8″ 8″, 9–12″ 12″, 13–16″ 16″.",
  },
  er: {
    code: "ER",
    name: "Eccentric Reducer",
    short: "eccentric",
    labels: ["A · large", "B · small"],
    defaults: [12, 8],
    out: 1,
    top: 0,
    bottom: null,
    lRule: "",
    rRule: "R = (A − B) × 1.5, 6″ min",
    ecc: true,
    text: "Large end A (2″ beaded end), a cone R long, flat along one side (bottom, as drawn), then small end B (2″ beaded end). R = 6″ for A − B of 1–3″, else (A − B) × 1.5.",
  },
};
/** A reducer's sizes, its reduction and R. */
function redDims(type: RedType, sizes: readonly number[]) {
  const a = sizes[0];
  const b = sizes[1];
  const ecc = REDS[type].ecc;
  return { a, b, drop: a - b, ecc, R: ecc ? eccentricLength(a, b) : reducerLength(a, b), past: !ecc && a - b > CR_TABLE_MAX };
}

/**
 * Reducer (sheet "Concentric and Eccentric Reducer") along x: the large end A's 2" collar on the left, the cone R long,
 * the small end B's 2" collar on the right. CR keeps the cone centred; ER keeps its bottom line flat (centre drops by
 * the radius difference). ends[0] is the small B end (connections go there), ends[1] the A end.
 */
function buildReducer(type: RedType, sizes: readonly number[], mats: Mats, style: EndStyle) {
  const { metal, inside } = mats;
  const { a, b, ecc, R } = redDims(type, sizes);
  const group = new THREE.Group();
  const rA = a / 2;
  const rB = b / 2;
  const wallA = Math.max(0.05, a * 0.006);
  const wallB = Math.max(0.05, b * 0.006);
  const radial = Math.min(144, 64 + Math.round(a * 4));
  const radialB = Math.min(144, 64 + Math.round(b * 4));
  const ribOf = (x: number) => Math.min(0.34, 0.04 + x * 0.012);
  const x0 = -R / 2;
  const k = (x: number) => (x - x0) / R;
  const cone = (ra: number, rb: number) => {
    const rows = 12;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const dr = (rb - ra) / R; // radius slope
    const dc = ecc ? (rB - rA) / R : 0; // centre slope (ER: bottom line flat)
    for (let i = 0; i <= rows; i++) {
      const x = x0 + (R * i) / rows;
      const rad = ra + (rb - ra) * k(x);
      const c = ecc ? (rB - rA) * k(x) : 0;
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        const cy = Math.cos(phi);
        const sz = Math.sin(phi);
        pos.push(x, c + rad * cy, rad * sz);
        const n = new THREE.Vector3(-(dc * cy + dr) * rad, rad * cy, rad * sz).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(j / radial, (x + 40) / TEX_LENGTH);
      }
    }
    return gridGeo(pos, nor, uv, rows + 1, radial + 1);
  };
  group.add(new THREE.Mesh(cone(rA, rB), metal));
  group.add(new THREE.Mesh(cone(rA - wallA, rB - wallB), inside));
  const fA = new THREE.Group();
  fA.position.set(x0 - COLLAR, 0, 0);
  fA.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(-1, 0, 0));
  fA.add(buildCollar(a, style, mats, ribOf(a) * 0.8, radial));
  const fB = new THREE.Group();
  fB.position.set(-x0 + COLLAR, ecc ? rB - rA : 0, 0);
  fB.add(buildCollar(b, style, mats, ribOf(b) * 0.8, radialB));
  group.add(fA, fB);
  return { group, ends: [fB, fA] };
}

/** Reducer connections: same, shown on the small B end. */
const RED_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "Shown on the small B end (right): it is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Shown on the small B end (right): straight end, no bead. A flange goes in the end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

function buildElbow(d: number, mats: Mats, style: EndStyle, kind: ElbowKind = "e90") {
  const { metal, inside, seam } = mats;
  const group = new THREE.Group();
  const r = d / 2;
  const R = ELBOWS[kind].clr * d;
  const wall = Math.max(0.05, d * 0.006);
  const radial = Math.min(144, 64 + Math.round(d * 4));
  const rib = Math.min(0.34, 0.04 + d * 0.012); // raised gore seam, in proportion to the size (3": 0.08", 12": 0.18", 24": 0.33")
  const bead = rib * 0.8; // rolled bead on each end

  if (kind === "ds90") {
    // One smooth pressed bend; the two halves (above and below the bend's plane) lap along the heel and the throat.
    group.add(new THREE.Mesh(bend(R, r, COLLAR, radial), metal));
    group.add(new THREE.Mesh(bend(R, r - wall, COLLAR, radial), inside));
    const lap = rib * 0.8;
    for (const side of [1, -1]) {
      // the raised lap along the seam, and the upper half's sheet edge lying over it (reads as a lapped joint)
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new BendLine(R + side * (r + lap * 0.25)), 48, lap, 8, false), seam));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new BendLine(R + side * (r + lap * 0.05), lap * 1.25), 48, lap * 0.5, 6, false), seam));
    }
  } else {
  // Gore k runs from joint a_k to a_k+1; end gores are tangent at the ends of the turn, middle gores at their middle.
  const tangents = SEAMS.slice(0, -1).map((a, k) => (k === 0 ? 0 : k === SEAMS.length - 2 ? Math.PI / 2 : (a + SEAMS[k + 1]) / 2));
  let vBase = COLLAR;
  tangents.forEach((t, k) => {
    const a0 = SEAMS[k];
    const a1 = SEAMS[k + 1];
    group.add(new THREE.Mesh(piece(t, R, r, miter(t, a0, R, r), miter(t, a1, R, r), vBase, radial), metal));
    group.add(new THREE.Mesh(piece(t, R, r - wall, miter(t, a0, R, r - wall), miter(t, a1, R, r - wall), vBase, radial), inside));
    vBase += 2 * R * Math.tan((a1 - a0) / 2) + 3;
  });
  // Raised seams at the four gore joints.
  for (let k = 1; k < SEAMS.length - 1; k++) {
    const loop = new JointLoop(tangents[k - 1], SEAMS[k], R, r + rib * 0.35);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(loop, radial, rib, 8, true), seam));
  }
  }
  // 2" straight ends.
  const ends = ([0, 1] as const).map((e) => {
    const f = endFrame(e, R);
    f.add(buildCollar(d, style, mats, bead, radial));
    group.add(f);
    return f;
  });
  return { group, ends };
}

/** Screws around the duct over the crimped end (one row), driven one after another. */
function crimpScrews(d: number, x: number, mat: THREE.Material) {
  const r = d / 2;
  const n = screwCount(d);
  const k = screwScale(d);
  const group = new THREE.Group();
  const items: NonNullable<BuiltConnection["screws"]>["items"] = [];
  const each = 0.4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 4;
    const obj = new THREE.Group();
    obj.position.set(x, r * Math.cos(a), r * Math.sin(a));
    obj.rotation.x = a; // local +Y -> radial
    const s = screwMesh(k, mat);
    obj.add(s.obj);
    group.add(obj);
    const start = (i / Math.max(1, n - 1)) * (1 - each);
    items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
  }
  return { group, items };
}

type Joint = {
  moving: { obj: THREE.Object3D; from: number; to: number }[];
  screws: NonNullable<BuiltConnection["screws"]>;
};

/**
 * Slip joint on one elbow end (in its end frame): the 12" piece of spiral duct starts pulled off the crimped end;
 * Play slides it over the crimp up to the bead, then screws go in around the duct over the crimp.
 */
function slipJoint(d: number, frame: THREE.Group, pipeMats: PipeMats, screwMat: THREE.Material): Joint {
  const gap = d <= 8 ? 1.5 : d <= 16 ? 2 : 2.5;
  const duct = buildPipe(d, pipeMats, JOIN_LENGTH);
  duct.position.x = gap + JOIN_LENGTH / 2;
  frame.add(duct);
  const stop = CRIMP_X - 0.03; // duct's end against the bead
  const screws = crimpScrews(d, (CRIMP_X + CRIMP_TAPER) / 2 - 0.15, screwMat);
  frame.add(screws.group);
  return { moving: [{ obj: duct, from: 0, to: stop - gap }], screws };
}

/** Flange on one elbow end: the duct's flanged joint (flange in the elbow end, gasket, flange on the 12" duct). */
function flangeJoint(d: number, frame: THREE.Group, pipeMats: PipeMats, metal: THREE.Material, sheet: THREE.Material, gasketMat: THREE.Material, screwMat: THREE.Material): Joint {
  const c = buildFlange(d, 0, metal, sheet, 1 / TEX_LENGTH, gasketMat, screwMat);
  frame.add(c.group);
  const duct = buildPipe(d, pipeMats, JOIN_LENGTH);
  duct.position.x = c.joinStart + JOIN_LENGTH / 2;
  frame.add(duct);
  if (c.screws) frame.add(c.screws.group);
  return {
    moving: [...c.motion.parts, { obj: duct, ...c.motion.piece }],
    screws: c.screws ?? { group: new THREE.Group(), items: [] },
  };
}

/**
 * Couplings, caps & collars (sheet 10 "Pipe Coupling and Fitting Coupling, End Cap, Start Collar, End Cap/Plug,
 * Bellmouth"), one model with a type picker and one size A. Each part is shown with what it goes on, see-through
 * (reference only, like the taps' pipe), pulled apart; Play puts it together and drives the screws.
 *   PC  pipe coupling: the Round pipe viewer's slip coupling (inside both pipe ends, raised centre bead = the sheet's
 *       solid centre line, crimped ends), at the sheet's 2" length, joining two spiral pipes (pipe ends are female).
 *   FC  fitting coupling: a plain 2" sleeve that goes OVER two fitting ends (fitting ends are male), with a ring of
 *       pressed-in dimples at its centre as the stop (the sheet's dashed centre line: a stop you can't see as a bead).
 *   EC  end cap: a flat disc A with a rolled rim and a short skirt that slips into a pipe end (plug style).
 *   SC  start collar: a 2" collar A with a 1" flange (OD A + 2) screwed to a flat duct / plenum wall over its hole.
 *   BM  bellmouth: ordered by A; 3" high: a 1" collar A on top (crimped, the duct slides over it up to the bead) and a
 *       2" radius flare out to B = A + 4 at the bottom, rolled edge.
 */
type CapSpec = CrossSpec & { short: string };
const CAPS: Record<CapType, CapSpec> = {
  pc: {
    code: "PC",
    name: "Pipe Coupling",
    short: "pipe",
    labels: ["A · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Pipe to pipe: a 2″ band A that slides inside both pipe ends; the raised centre bead stops each pipe. Crimped ends, screwed. Shown pulled apart.",
  },
  fc: {
    code: "FC",
    name: "Fitting Coupling",
    short: "fitting",
    labels: ["A · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Fitting to fitting: a plain 2″ sleeve A that slides over both fitting ends, stopped by dimples at its centre. Screwed. Shown pulled apart.",
  },
  ec: {
    code: "EC",
    name: "End Cap",
    short: "cap",
    labels: ["A · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Closes an open end: a flat disc A with a rolled rim and a short skirt that slips into the pipe end, then screwed. Shown pulled apart.",
  },
  sc: {
    code: "SC",
    name: "Start Collar",
    short: "collar",
    labels: ["A · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Starts a run off a duct or plenum wall: a 2″ collar A with a 1″ flange (A + 2″ across), screwed to the wall over the hole. Shown pulled apart.",
  },
  bm: {
    code: "BM",
    name: "Bellmouth",
    short: "bell",
    labels: ["A · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Ordered by A. Open intake: 3″ high, the collar A on top, a smooth flare out to B = A + 4″ at the bottom. The duct slides over the collar.",
  },
};
const CAP_LEN = 2; // PC / FC band, SC collar (sheet)
const BM_H = 3;
const BM_FLARE = 2; // flare out (each side) and its height: B = A + 4
/** A sheet 10 part's dims for the info row. */
function capDims(type: CapType, a: number) {
  return { a, b: a + 2 * BM_FLARE, flange: a + 2, type };
}

/** Screws around a pipe of radius r at each x (one row per x), driven one after another. */
function ringScrews(d: number, r: number, xs: number[], mat: THREE.Material, n = screwCount(d)) {
  const k = screwScale(d);
  const group = new THREE.Group();
  const items: NonNullable<BuiltConnection["screws"]>["items"] = [];
  const win = 1 / xs.length;
  const each = win * 0.55;
  xs.forEach((x, side) => {
    for (let i = 0; i < n; i++) {
      const a = ((i + side * 0.5) / n) * Math.PI * 2 + Math.PI / 4;
      const obj = new THREE.Group();
      obj.position.set(x, r * Math.cos(a), r * Math.sin(a));
      obj.rotation.x = a; // local +Y -> radial
      const s = screwMesh(k, mat);
      obj.add(s.obj);
      group.add(obj);
      const start = side * win + (i / Math.max(1, n - 1)) * (win - each);
      items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
    }
  });
  return { group, items };
}

/** A fitting's end, see-through (reference): a short straight body and its 2" beaded collar, open end at x = 0, +X out. */
function ghostFittingEnd(d: number, ref: PipeMats, len = 4.5) {
  const g = new THREE.Group();
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const radial = Math.min(144, 64 + Math.round(d * 4));
  const uv = 1 / TEX_LENGTH;
  const xs = [-len, -COLLAR];
  g.add(new THREE.Mesh(shell(xs, radial, () => r, uv), ref.metal));
  g.add(new THREE.Mesh(shell(xs, radial, () => r - wall, uv), ref.inside));
  g.add(buildCollar(d, "bead", { metal: ref.metal, inside: ref.inside, seam: ref.rim }, Math.min(0.34, 0.04 + d * 0.012) * 0.8, radial));
  return g;
}

/** Flat ring in the YZ plane, thickness 0..t along +X. */
function flatRing(ri: number, ro: number, t: number, segs: number, uvScale: number) {
  const shape = new THREE.Shape(new THREE.EllipseCurve(0, 0, ro, ro, 0, Math.PI * 2, false, 0).getPoints(segs));
  shape.holes.push(new THREE.Path(new THREE.EllipseCurve(0, 0, ri, ri, 0, Math.PI * 2, true, 0).getPoints(segs)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
  geo.rotateY(Math.PI / 2);
  const puv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * uvScale, puv.getY(i) * uvScale);
  return geo;
}

/**
 * Build one sheet 10 part with what it goes on (see-through), along X; SC and BM are turned to stand up (+X -> up).
 * Returns the group and the Play motion (X offsets of the moving parts in their parent frame) and screws.
 */
function buildCap(type: CapType, a: number, sheet: THREE.Material, ref: PipeMats, seam: THREE.Material, screwMat: THREE.Material) {
  const d = a;
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const radial = Math.min(160, 64 + Math.round(d * 4));
  const uv = 1 / TEX_LENGTH;
  const group = new THREE.Group();
  const gap = d <= 8 ? 1.5 : d <= 16 ? 2 : 2.5;
  const PIPE = 5; // see-through pipe / duct pieces (short, so the part itself fills the view)
  let moving: Joint["moving"] = [];
  let screws: Joint["screws"] = { group: new THREE.Group(), items: [] };

  if (type === "pc") {
    // The pipe viewer's slip coupling at 2": main pipe (ends at 0) | gap | coupling | gap | pipe.
    const c = buildCoupling(d, 0, sheet, uv, screwMat, { length: CAP_LEN, screwBack: 0.4 });
    group.add(c.group);
    const p0 = buildPipe(d, ref, PIPE);
    p0.position.x = -PIPE / 2;
    const p1 = buildPipe(d, ref, PIPE);
    p1.position.x = c.joinStart + PIPE / 2;
    group.add(p0, p1);
    if (c.screws) screws = c.screws;
    moving = [...c.motion.parts, { obj: p1, ...c.motion.piece }];
  } else if (type === "fc") {
    // Plain sleeve over both fitting ends; centre dimples (the stop) read as a dashed ring.
    const ri = r + 0.05;
    const ro = ri + wall;
    const nd = Math.max(10, Math.round((Math.PI * 2 * ro) / 1.1));
    const dw = 0.14;
    const depth = 0.07 + d * 0.002;
    const xs = samples(-CAP_LEN / 2, CAP_LEN / 2, (x) => Math.abs(x) < dw + 0.05, 0.025, 0.25);
    const dent = (x: number, ang: number) => {
      if (Math.abs(x) >= dw) return 0;
      const p = 0.5 * (1 + Math.cos(nd * ang));
      const dash = Math.min(1, Math.max(0, (p - 0.35) / 0.3));
      return depth * 0.5 * (1 + Math.cos((Math.PI * x) / dw)) * dash * dash * (3 - 2 * dash);
    };
    const segs = Math.min(900, nd * 14);
    const sleeve = new THREE.Group();
    sleeve.add(new THREE.Mesh(shell(xs, segs, (x, ang) => ro - dent(x, ang), uv), sheet));
    for (const x of [-CAP_LEN / 2, CAP_LEN / 2]) {
      const hem = new THREE.TorusGeometry(ro - wall / 2, Math.max(0.045, wall * 0.9), 6, radial);
      hem.rotateY(Math.PI / 2);
      hem.translate(x, 0, 0);
      sleeve.add(new THREE.Mesh(hem, sheet));
    }
    group.add(sleeve);
    const stop = 0.06; // each fitting end stops just short of the centre (on the dimples)
    const fL = ghostFittingEnd(d, ref);
    fL.position.x = -CAP_LEN / 2 - gap;
    const fR = ghostFittingEnd(d, ref);
    fR.rotation.y = Math.PI;
    fR.position.x = CAP_LEN / 2 + gap;
    group.add(fL, fR);
    moving = [
      { obj: fL, from: 0, to: CAP_LEN / 2 + gap - stop },
      { obj: fR, from: 0, to: -(CAP_LEN / 2 + gap - stop) },
    ];
    screws = ringScrews(d, ro, [-CAP_LEN / 4 - stop / 2, CAP_LEN / 4 + stop / 2], screwMat);
  } else if (type === "ec") {
    // Disc A (rolled rim) facing +X, skirt -1..0 that slips into the pipe end (pipe ends at x = 0).
    const SKIRT = 1;
    const rs = r - wall - 0.03;
    const cap = new THREE.Group();
    const face = new THREE.CircleGeometry(r + 0.02, radial);
    face.rotateY(Math.PI / 2);
    const fuv = face.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) * d) / TEX_LENGTH, (fuv.getY(i) * d) / TEX_LENGTH);
    cap.add(new THREE.Mesh(face, sheet));
    const rim = new THREE.TorusGeometry(r + 0.02, Math.max(0.07, d * 0.006), 8, radial);
    rim.rotateY(Math.PI / 2);
    cap.add(new THREE.Mesh(rim, sheet));
    cap.add(new THREE.Mesh(shell([-SKIRT, -0.05], radial, () => rs, uv), sheet));
    // A shallow stiffening bead pressed in the face.
    const emb = new THREE.TorusGeometry(r * 0.62, Math.min(0.12, 0.04 + d * 0.004), 8, radial);
    emb.rotateY(Math.PI / 2);
    emb.translate(0.01, 0, 0);
    cap.add(new THREE.Mesh(emb, sheet));
    cap.position.x = gap + SKIRT;
    group.add(cap);
    const p = buildPipe(d, ref, PIPE);
    p.position.x = -PIPE / 2;
    group.add(p);
    moving = [{ obj: cap, from: 0, to: -(gap + SKIRT) }];
    screws = ringScrews(d, r, [-SKIRT / 2], screwMat);
  } else if (type === "sc") {
    // Wall (see-through) in the YZ plane at x = 0 with the hole; collar + flange on its +X face, pulled off by gap.
    const t = 0.075;
    const side = d + 6;
    const wallShape = new THREE.Shape([
      new THREE.Vector2(-side / 2, -side / 2),
      new THREE.Vector2(side / 2, -side / 2),
      new THREE.Vector2(side / 2, side / 2),
      new THREE.Vector2(-side / 2, side / 2),
    ]);
    wallShape.holes.push(new THREE.Path(new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, true, 0).getPoints(radial)));
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 0.06, bevelEnabled: false, curveSegments: 1 });
    wallGeo.rotateY(Math.PI / 2);
    wallGeo.translate(-0.06, 0, 0);
    const wallMesh = new THREE.Mesh(wallGeo, ref.metal);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wallGeo, 30), new THREE.LineBasicMaterial({ color: 0x8e9bab, transparent: true, opacity: 0.55 }));
    group.add(wallMesh, edges);
    const col = new THREE.Group();
    col.add(new THREE.Mesh(flatRing(r - 0.01, r + 1, t, radial, uv), sheet));
    const lip = new THREE.TorusGeometry(r + 1, 0.07, 8, radial);
    lip.rotateY(Math.PI / 2);
    lip.translate(t / 2, 0, 0);
    col.add(new THREE.Mesh(lip, sheet));
    col.add(new THREE.Mesh(shell([0, CAP_LEN], radial, () => r, uv), sheet));
    const crim = new THREE.RingGeometry(r - wall, r + 0.005, radial);
    crim.rotateY(Math.PI / 2);
    crim.translate(CAP_LEN, 0, 0);
    col.add(new THREE.Mesh(crim, sheet));
    col.position.x = gap;
    group.add(col);
    moving = [{ obj: col, from: 0, to: -gap }];
    // Screws through the flange into the wall, parallel to the collar (heads on the flange, facing +X).
    const n = screwCount(d);
    const k = screwScale(d);
    const sg = new THREE.Group();
    const items: Joint["screws"]["items"] = [];
    const each = 0.4;
    for (let i = 0; i < n; i++) {
      const ang = ((i + 0.5) / n) * Math.PI * 2;
      const obj = new THREE.Group();
      obj.position.set(t, (r + 0.5) * Math.cos(ang), (r + 0.5) * Math.sin(ang));
      obj.rotation.z = -Math.PI / 2;
      const s = screwMesh(k * 0.85, screwMat);
      obj.add(s.obj);
      sg.add(obj);
      const start = (i / Math.max(1, n - 1)) * (1 - each);
      items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
    }
    screws = { group: sg, items };
    group.rotation.z = Math.PI / 2; // stand it up: the wall level, the collar pointing up
  } else {
    // Bellmouth along +X (up): flare x 0..2 from B/2 to A/2 (quarter circle, radius 2), bead at 2, crimped collar 2..3.
    const rB = r + BM_FLARE;
    const flare = (x: number) => r + BM_FLARE - Math.sqrt(Math.max(0, BM_FLARE * BM_FLARE - (x - BM_FLARE) * (x - BM_FLARE)));
    const fx: number[] = [];
    for (let i = 0; i <= 28; i++) fx.push(BM_FLARE - BM_FLARE * Math.sin((i / 28) * (Math.PI / 2)));
    fx.reverse();
    const bm = new THREE.Group();
    bm.add(new THREE.Mesh(shell(fx, radial, (x) => flare(x), uv), sheet));
    // Collar: steps in past the bead and is fluted (like the fittings' crimped ends) so the duct slides over it.
    const flutes = Math.max(24, Math.round((Math.PI * 2 * (r - wall - 0.05)) / 0.42));
    const cd = 0.1 + d * 0.003;
    const c0 = BM_FLARE + 0.3;
    const rcr = r - wall - 0.05;
    const crad = (x: number, ang: number) => {
      if (x < c0) return r;
      const e = Math.min(1, (x - c0) / CRIMP_TAPER);
      const k = e * e * (3 - 2 * e);
      return r - (r - rcr) * k - cd * k * 0.5 * (1 - Math.cos(flutes * ang));
    };
    const cx = samples(BM_FLARE, BM_H, (x) => x > c0 - 0.05, 0.05, 0.3);
    bm.add(new THREE.Mesh(shell(cx, flutes * 4, crad, uv), sheet));
    const bead = new THREE.TorusGeometry(r + 0.04, Math.min(0.34, 0.04 + d * 0.012) * 0.8, 8, radial);
    bead.rotateY(Math.PI / 2);
    bead.translate(BM_FLARE + 0.12, 0, 0);
    bm.add(new THREE.Mesh(bead, seam));
    const roll = new THREE.TorusGeometry(rB, 0.12, 8, Math.min(200, radial + 24));
    roll.rotateY(Math.PI / 2);
    roll.translate(0.06, 0, 0);
    bm.add(new THREE.Mesh(roll, sheet));
    group.add(bm);
    // Duct above, pulled off; Play slides it down over the collar up to the bead.
    const stopX = BM_FLARE + 0.3;
    const duct = buildPipe(d, ref, PIPE);
    duct.position.x = BM_H + gap + PIPE / 2;
    group.add(duct);
    moving = [{ obj: duct, from: 0, to: stopX - (BM_H + gap) }];
    screws = ringScrews(d, r, [(stopX + BM_H) / 2 + 0.1], screwMat);
    group.rotation.z = Math.PI / 2;
  }
  // Screws are placed in the assembled pose, in the parts' frame (turned with the group).
  group.add(screws.group);
  return { group, moving, screws };
}

/**
 * Clam shell hangers (sheet 13 "Clam Shell Hangers"), one model with a type picker and one size, the pipe it holds.
 * Only the hanger is the product: the pipe, the threaded rods and the nuts are shown see-through (rod not included).
 *   WHOLE  two half-round straps around the pipe, each ending in a flat 2" ear on each side at the horizontal
 *          centreline, the upper half's ears stacked on the lower half's, each with a pre-drilled 7/16" hole; a
 *          threaded rod runs up through the holes on each side.
 *   HALF   the bottom half only: a U strap cradling the pipe, its 2" ears hung on the rods.
 * Strap width and gauge come from the sheet's own table by pipe size (hangerStrap(), not the duct gauge table).
 * Assumed (the sheet shows no number): the hole is centred on the 2" ear; a 3/8" rod (fits the 7/16" hole); a nut and
 * washer each side of the ears; the strap hugs the pipe. Play ("how it goes on"): the rods are in place, the halves
 * come in around the pipe along the rods (the lower half up onto the rod ends, the upper half down), then the nuts
 * run along the rods and snug. Pipe axis along Z (the end view faces the camera, as drawn), rods vertical (Y).
 */
type HangerSpec = CrossSpec & { short: string };
const HANGERS: Record<HangerType, HangerSpec> = {
  whole: {
    code: "WHOLE",
    name: "Whole Clam Shell Hanger",
    short: "2 halves",
    labels: ["Pipe · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "Two half-round straps clamp round the pipe; their flat 2″ ears stack on each side, each with a 7/16″ hole for the threaded rod. Pipe, rods and nuts see-through.",
  },
  half: {
    code: "HALF",
    name: "Half Clam Shell Hanger",
    short: "bottom U",
    labels: ["Pipe · size"],
    defaults: [12],
    out: 0,
    top: 0,
    bottom: null,
    lRule: "",
    text: "The bottom half only: a U strap cradles the pipe, its flat 2″ ears (7/16″ holes) hung on the threaded rods. Pipe, rods and nuts see-through.",
  },
};
/** The sheet's strap table by pipe diameter (sizes between rows, e.g. 29″ or 39″, would take the row below). */
const HANGER_TABLE = [
  { to: 15, w: 1, ga: 20, row: "3″–15″" },
  { to: 29, w: 1, ga: 18, row: "16″–28″" },
  { to: 39, w: 1, ga: 16, row: "30″–38″" },
  { to: Infinity, w: 1.5, ga: 16, row: "40″–64″" },
] as const;
const GAUGE_IN: Record<number, number> = { 20: 0.0359, 18: 0.0478, 16: 0.0598 };
const EAR = 2; // flat ear past the strap (sheet)
const HOLE_D = 7 / 16; // pre-drilled hole (sheet)
const ROD_D = 3 / 8; // threaded rod (assumed: fits the 7/16" hole)
function hangerStrap(d: number) {
  const row = HANGER_TABLE.find((r) => d <= r.to)!;
  return { w: row.w, ga: row.ga, t: GAUGE_IN[row.ga], row: row.row };
}
function hangerDims(type: HangerType, d: number) {
  return { type, d, ...hangerStrap(d) };
}

/** Part of a flat strap bent round the Z axis: inner radius R, thickness t, width w (along Z), angles a0..a1. */
function bandArc(R: number, t: number, w: number, a0: number, a1: number, segs: number, uvU: number, uvV: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const at = (i: number) => a0 + ((a1 - a0) * i) / segs;
  // Outer (normal out) and inner (normal in) faces.
  for (const [rr, out] of [
    [R + t, true],
    [R, false],
  ] as const) {
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const a = at(i);
      const c = Math.cos(a);
      const s = Math.sin(a);
      for (const z of [-w / 2, w / 2]) {
        pos.push(rr * c, rr * s, z);
        nor.push(out ? c : -c, out ? s : -s, 0);
        uv.push(rr * (a - a0) * uvU, (z + w / 2) * uvV);
      }
    }
    for (let i = 0; i < segs; i++) {
      const k = base + i * 2;
      if (out) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  // The two edges (z = ±w/2).
  for (const z of [-w / 2, w / 2]) {
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const a = at(i);
      for (const rr of [R, R + t]) {
        pos.push(rr * Math.cos(a), rr * Math.sin(a), z);
        nor.push(0, 0, Math.sign(z));
        uv.push(rr * (a - a0) * uvU, rr * uvV);
      }
    }
    for (let i = 0; i < segs; i++) {
      const k = base + i * 2;
      if (z > 0) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      else idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A flat ear: x0..x1 (either side of 0), w wide along Z, thickness t from y0 up, with the 7/16" hole at xh. */
function earPlate(x0: number, x1: number, w: number, t: number, y0: number, xh: number, uvU: number, uvV: number) {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  const shape = new THREE.Shape([new THREE.Vector2(lo, -w / 2), new THREE.Vector2(hi, -w / 2), new THREE.Vector2(hi, w / 2), new THREE.Vector2(lo, w / 2)]);
  shape.holes.push(new THREE.Path(new THREE.EllipseCurve(xh, 0, HOLE_D / 2, HOLE_D / 2, 0, Math.PI * 2, true, 0).getPoints(28)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2); // extrusion -> up (+Y), the shape's width -> Z
  geo.translate(0, y0, 0);
  const puv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * uvU, puv.getY(i) * uvV);
  return geo;
}

/** Hex nut on a flat washer, sitting on y = 0 and going up (+Y), round a 3/8" rod. */
function nutMesh(mat: THREE.Material) {
  const g = new THREE.Group();
  const WASHER_T = 0.06;
  const washer = new THREE.CylinderGeometry(0.5, 0.5, WASHER_T, 28);
  washer.translate(0, WASHER_T / 2, 0);
  const hex = new THREE.Shape(Array.from({ length: 6 }, (_, i) => new THREE.Vector2(0.325 * Math.cos((i * Math.PI) / 3), 0.325 * Math.sin((i * Math.PI) / 3))));
  hex.holes.push(new THREE.Path(new THREE.EllipseCurve(0, 0, ROD_D / 2, ROD_D / 2, 0, Math.PI * 2, true, 0).getPoints(16)));
  const nut = new THREE.ExtrudeGeometry(hex, { depth: 0.33, bevelEnabled: false, curveSegments: 1 });
  nut.rotateX(-Math.PI / 2);
  nut.translate(0, WASHER_T, 0);
  g.add(new THREE.Mesh(washer, mat), new THREE.Mesh(nut, mat));
  return { obj: g, height: WASHER_T + 0.33 };
}

/**
 * Build one clam shell hanger on its see-through pipe, rods and nuts, in the pulled-apart pose (Play moves it together).
 * Returns the group, the Play motion and the nuts (driven like the screws: along the rod, turning).
 */
function buildHanger(type: HangerType, d: number, strapMat: THREE.Material, ref: PipeMats, rodMat: THREE.Material, nutMat: THREE.Material) {
  const group = new THREE.Group();
  const r = d / 2;
  const s = hangerStrap(d);
  const t = Math.max(s.t, 0.05); // drawn a touch thicker at 20 ga so the edge shows
  const R = r + 0.02; // the strap hugs the pipe
  const xh = R + t + EAR / 2; // hole centred on the ear (assumed)
  const segs = Math.min(160, 48 + Math.round(d * 2));
  const uvU = 1 / (Math.PI * d);
  const uvV = 1 / TEX_LENGTH;
  const halfLift = Math.max(3, d * 0.2); // how far each half starts off the pipe
  const nutLift = Math.max(1.5, d * 0.05); // how far each nut starts along the rod

  // See-through pipe along Z.
  const pipe = buildPipe(d, ref, Math.max(8, d * 0.45));
  pipe.rotation.y = Math.PI / 2;
  group.add(pipe);

  // One strap half: the arc and its two ears (upper: ears on top of the centreline, lower: under it).
  const half = (upper: boolean) => {
    const h = new THREE.Group();
    h.add(new THREE.Mesh(bandArc(R, t, s.w, upper ? 0 : Math.PI, upper ? Math.PI : Math.PI * 2, segs, uvU, uvV), strapMat));
    const y0 = upper ? 0 : -t;
    h.add(new THREE.Mesh(earPlate(R, R + t + EAR, s.w, t, y0, xh, uvU, uvV), strapMat));
    h.add(new THREE.Mesh(earPlate(-R, -(R + t + EAR), s.w, t, y0, -xh, uvU, uvV), strapMat));
    return h;
  };
  // Moves along Y: a frame turned so its X is world +Y (Play moves X), the half turned back inside it.
  const moving: Joint["moving"] = [];
  const slideY = (obj: THREE.Object3D, y0: number) => {
    const f = new THREE.Group();
    f.rotation.z = Math.PI / 2;
    const slider = new THREE.Group();
    slider.position.x = y0;
    obj.rotation.z = -Math.PI / 2;
    slider.add(obj);
    f.add(slider);
    group.add(f);
    moving.push({ obj: slider, from: 0, to: -y0 });
  };
  slideY(half(false), -halfLift);
  if (type === "whole") slideY(half(true), halfLift);

  // Nuts: the stack's top (whole: upper ear) and bottom (lower ear); one under and one over the ears on each side.
  const top = type === "whole" ? t : 0;
  const bottom = -t;
  const nut = nutMesh(nutMat);
  const items: Joint["screws"]["items"] = [];
  const sg = new THREE.Group();
  const each = 0.4;
  const placed: [number, boolean][] = [
    [-xh, false],
    [xh, false],
    [-xh, true],
    [xh, true],
  ];
  placed.forEach(([x, over], i) => {
    const obj = new THREE.Group();
    obj.position.set(x, over ? top : bottom, 0);
    if (!over) obj.rotation.x = Math.PI; // under the ear: local +Y points down, so it runs up the rod
    const n = nut.obj.clone();
    obj.add(n);
    sg.add(obj);
    const start = (i / (placed.length - 1)) * (1 - each);
    items.push({ obj, drive: n, start, end: start + each, lift: nutLift });
  });

  // Rods: from above the pipe down past the lower nuts (the hanger halves slide onto their ends).
  const rodTop = R + t + Math.max(3, d * 0.15);
  const rodBottom = bottom - nut.height - nutLift - 0.75;
  for (const x of [-xh, xh]) {
    const rod = new THREE.CylinderGeometry(ROD_D / 2, ROD_D / 2, rodTop - rodBottom, 16, 1, false);
    rod.translate(x, (rodTop + rodBottom) / 2, 0);
    group.add(new THREE.Mesh(rod, rodMat));
  }
  group.add(sg);
  return { group, moving, screws: { group: sg, items } };
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

const inches = (x: number) => (Number.isInteger(x) ? `${x}` : `${Math.floor(x)}½`);

/** Elbow connections: same buttons as the duct; captions describe the elbow's end. */
const ELBOW_CONNECTION_INFO: Record<Connection, { title: string; text: string }> = {
  none: {
    title: "Gored 90° Elbow (E90)",
    text: "90° 5-piece gored elbow. Centerline radius 1.5 × diameter, 2″ straight ends.",
  },
  coupling: {
    title: "Coupling (slip joint)",
    text: "The elbow end is crimped past the bead. The duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Straight elbow ends, no beads. A flange goes in the elbow end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Tee connections: same, shown on the branch (A) end. */
const TEE_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "Shown on the branch (A) end: it is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Shown on the branch (A) end: straight ends, no beads. A flange goes in the end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Wye connections: on all three ends at once (on RY45 the legs' small B / C ends, past their reducers). */
const WYE_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "On all three ends (reducing legs: the small end): each is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "On all three ends (reducing legs: the small end): straight ends, no beads. A flange goes in each end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Offset connections: on both round A ends at once. */
const OS_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "On both A ends: each is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "On both A ends: straight ends, no beads. A flange goes in each end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Square to round connections: on the round A end only (the rectangular end stays a plain 2" collar). */
const SQ2RD_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "On the round A end (the rectangular end is a plain collar): crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "On the round A end (the rectangular end is a plain collar): straight end, no bead. A flange goes in the end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Tee/cross connections: same, shown on the A inlet end (left). */
const CROSS_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "Shown on the A inlet end (left): it is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Shown on the A inlet end (left): straight ends, no beads. A flange goes in the end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Tap connections: same, shown on the tap's top (A) end. */
const TAP_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "Shown on the tap's top (A) end: it is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Shown on the tap's top (A) end: straight end, no bead. A flange goes in the end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Lateral tap connections: same, shown on the branch's A end. */
const LTAP_CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "Shown on the tap's A end (the 45° branch): it is crimped past the bead, the duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Shown on the tap's A end (the 45° branch): straight end, no bead. A flange goes in the end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

/** Play timing, same as the duct: slide together, short pause, drive the screws. */
const SLIDE_MS = 2300;
const SCREW_PAUSE_MS = 200;
const SCREW_MS = 2300;
const SCREW_TURNS = 4;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";

export default function GoredElbow3D({ onClose, kind = "e90", teeType: teeTypeIn }: { onClose: () => void; kind?: ElbowKind; teeType?: TeeType | CteeType | LatType | TapType | LtapType | RedType | CapType | WyeType | OsType | HangerType }) {
  const spec = ELBOWS[kind];
  // Tees & Crosses or Conical Tees & Crosses: their types (same picker and size selects).
  const conical = kind === "ctee";
  const lateral = kind === "lat";
  // Straight & Conical Taps: same picker and size selects (A, then the pipe P), A limited by P instead of the other way.
  // Lateral Taps: the same as the taps (A, then P), with its own two types and L.
  const ltaps = kind === "ltap";
  const taps = kind === "tap" || ltaps;
  const tapFam: Record<string, TapSpec> = ltaps ? LTAPS : TAPS;
  // Reducers: same picker and size selects (A, then B below A).
  const reds = kind === "red";
  // Couplings, caps & collars (sheet 10): same picker, one size A; no connection buttons (Play puts the part on).
  const caps = kind === "cap";
  // Wyes (sheet 11): same picker and size selects (A, then B and C up to A on RY45); connections on all three ends.
  const wyes = kind === "wye";
  // Offset / square to round (sheet 12): same picker; OS sizes A and the offset, SQ2RD H, W and the round A.
  const oss = kind === "os";
  // Clam shell hangers (sheet 13): same picker (whole / half), one pipe size; no connection buttons (Play puts it on).
  const hangers = kind === "hanger";
  const fam: Record<string, CrossSpec> = conical ? CTEES : lateral ? LATS : taps ? tapFam : reds ? REDS : caps ? CAPS : wyes ? WYES : oss ? OSS : hangers ? HANGERS : TEES;
  const teeType0: string = teeTypeIn ?? (conical ? "ct90" : lateral ? "l45" : ltaps ? "lst45" : taps ? "sst90" : reds ? "cr" : caps ? "pc" : wyes ? "y45" : oss ? "os" : hangers ? "whole" : "t90");
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setDiameter: (d: number) => void;
    setConnection: (c: Connection) => void;
    setVanes: (n: number) => void;
    setRun: (b: number, c: number) => void;
    setCross: (type: string, sizes: readonly number[]) => void;
    setTopInset: (px: number) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [diameter, setDiameter] = useState(spec.defaultD);
  const [connection, setConnection] = useState<Connection>("none");
  const [vanesOn, setVanesOn] = useState(false);
  const hasVanes = kind === "me90" || kind === "bt90";
  const vanes = hasVanes && vanesOn ? vaneSpec(diameter) : null; // shown only from 8" (sheet's table)
  // Bullhead tee run outlets B (left) and C (right), each no bigger than A.
  const [runB, setRunB] = useState(TEE_RUN_DEFAULT);
  const [runC, setRunC] = useState(TEE_RUN_DEFAULT);
  // Tees & crosses: the type, and its sizes (A first, the rest no bigger than A).
  const [teeType, setTeeType] = useState<string>(teeType0);
  const [teeSizes, setTeeSizes] = useState<readonly number[]>(fam[teeType0].defaults);
  const [play, setPlay] = useState<PlayState>("idle");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const cross = kind === "tee" || conical || lateral || taps || reds || caps || wyes || oss || hangers;
  const hangerD = hangers ? hangerDims(teeType as HangerType, teeSizes[0]) : null;
  const osD = oss ? osDims(teeType as OsType, teeSizes) : null;
  // SQ2RD: gauge by the larger of H and W (the sheet's biggest dimension); everything else by A.
  const gauge = stockGauge(osD ? osD.gaugeD : cross ? teeSizes[0] : diameter);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("aria-label", spec.canvas);
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xf4f7fb, 0x7d8b99, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 60, 40);
    scene.add(sun);

    // Same materials as the Round pipe viewer.
    const spangle = spangleTexture();
    const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangle, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95 });
    const seam = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const inside = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.7, roughness: 0.5, side: THREE.BackSide, envMapIntensity: 0.6 });
    const sheet = metal.clone();
    sheet.side = THREE.DoubleSide;
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4 });
    const pipeMats: PipeMats = { metal, inside, seam, rim: metal };
    // Mitered elbow with vanes: the elbow's walls go see-through so the vanes inside read (connections stay solid).
    const ghost = (m: THREE.MeshStandardMaterial, opacity: number) => {
      const g = m.clone();
      g.transparent = true;
      g.opacity = opacity;
      g.depthWrite = false;
      return g;
    };
    const ghostMats: Mats = { metal: ghost(metal, 0.28), inside: ghost(inside, 0.16), seam: ghost(seam, 0.85) };
    // Taps: the pipe P they go on, faint and see-through (reference only, not part of the fitting).
    // Saddle plate: same metal, toned down (it faces up into the light and would read white).
    const plateMat = metal.clone();
    (plateMat as THREE.MeshStandardMaterial).color.set(0xc9d0d8);
    (plateMat as THREE.MeshStandardMaterial).envMapIntensity = 0.7;
    const refMats: PipeMats = { metal: ghost(metal, 0.16), inside: ghost(inside, 0.08), seam: ghost(seam, 0.22), rim: ghost(seam, 0.6) };
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, map: spangle, metalness: 0.5, roughness: 0.42, envMapIntensity: 1, side: THREE.DoubleSide });
    const vaneEdge = new THREE.MeshStandardMaterial({ color: 0x5f6b77, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8 });
    // Clam shell hangers: the threaded rods and nuts are not included, so see-through (a bit stronger than the pipe).
    const rodMat = ghost(screwMat, 0.42);

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      setHint(false);
    });

    // Canvas size, and the strip at the top covered by the caption card (the model is framed in the space below it).
    let W = 1;
    let H = 1;
    let inset = 0;
    const project = () => {
      const h = Math.max(1, H - inset);
      camera.aspect = W / h;
      camera.setViewOffset(W, h, 0, -inset, W, H);
      camera.updateProjectionMatrix();
    };

    // model holds the elbow turned like the sheet's drawing (one end pointing down, the other to the right),
    // plus the connection on the bottom end, centred on its bounding box so the auto-spin turns it in place.
    let model: THREE.Group | null = null;
    // Viewing direction: front three-quarter; with vanes, more from the side so the blades show their faces.
    let view = new THREE.Vector3(0.3, 0.32, 1);
    const frame = (d: number) => {
      if (!model) return;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      // It spins about the vertical axis: keep the whole turning circle (corner of the box) clear, plus the near side's
      // perspective growth, so no angle runs off the screen.
      const spin = Math.hypot(size.x, size.z) / 2;
      shadow.scale.set(spin * 2.3, spin * 2.3, 1);
      shadow.position.set(0, box.min.y - 0.05, 0);
      const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const halfW = spin * 1.12;
      const halfH = (size.y / 2) * 1.08;
      const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.04 + d / 4;
      const dir = view.clone().normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.minDistance = d * 0.9;
      controls.maxDistance = dist * 2.2;
      camera.near = Math.max(0.1, d * 0.05);
      camera.far = dist * 6;
      project();
      controls.update();
    };

    // ---- Play: slide the parts together (X offsets in the end frame), then drive the screws. playT is elapsed ms. ----
    let moving: { obj: THREE.Object3D; base: number; from: number; to: number }[] = [];
    let screws: NonNullable<BuiltConnection["screws"]>["items"] = [];
    const playMs = SLIDE_MS + SCREW_PAUSE_MS + SCREW_MS;
    let playT = 0;
    let playing = false;
    let lastTime = 0;
    const pose = (t: number | null) => {
      const k = t === null ? 0 : easeInOut(Math.min(1, t / SLIDE_MS));
      for (const m of moving) m.obj.position.x = m.base + (t === null ? 0 : m.from + (m.to - m.from) * k);
      const s = t === null ? -1 : (t - SLIDE_MS - SCREW_PAUSE_MS) / SCREW_MS;
      for (const sc of screws) {
        const shown = s >= sc.start;
        sc.obj.visible = shown;
        if (!shown) continue;
        const u = Math.min(1, (s - sc.start) / (sc.end - sc.start));
        const e = easeInOut(u);
        sc.drive.position.y = sc.lift * (1 - e);
        sc.drive.rotation.y = -e * SCREW_TURNS * Math.PI * 2;
        sc.drive.scale.setScalar(Math.min(1, 0.4 + u * 4));
      }
    };
    const stopPlay = () => {
      playing = false;
      playT = 0;
      pose(null);
      setPlay("idle");
    };
    const togglePlay = () => {
      if (!moving.length) return;
      if (playing) {
        playing = false;
        setPlay("paused");
        return;
      }
      if (playT === 0 || playT >= playMs) {
        playT = 0;
        pose(0);
      }
      playing = true;
      lastTime = performance.now();
      setPlay("playing");
    };
    const stepPlay = (now: number) => {
      if (!playing) return;
      playT = Math.min(playMs, playT + (now - lastTime));
      lastTime = now;
      pose(playT);
      if (playT >= playMs) {
        playing = false;
        setPlay("done");
      }
    };

    const build = (d: number, c: Connection, v = 0) => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const style: EndStyle = c === "coupling" ? "crimp" : c === "flange" ? "plain" : "bead";
      view = v > 0 ? (kind === "bt90" ? new THREE.Vector3(0.22, 0.2, 1) : new THREE.Vector3(-0.85, 0.42, 1)) : new THREE.Vector3(0.3, 0.32, 1);
      if (kind === "tap") view = new THREE.Vector3(0.35, 0.55, 1); // taps: more from above, so the saddle plate reads
      if (kind === "ltap") view = new THREE.Vector3(0.22, 0.42, 1); // lateral taps: a bit lower, so the 45° lean reads too
      if (kind === "cap" || kind === "hanger") {
        // Sheet 10 parts: built with their see-through duct / wall, own Play motion; no connection.
        // Sheet 13 hangers: the same, on their see-through pipe, rods and nuts.
        const t = currentTee as CapType;
        view = kind === "hanger" ? new THREE.Vector3(0.42, 0.2, 1) : t === "sc" ? new THREE.Vector3(0.35, 0.6, 1) : t === "bm" ? new THREE.Vector3(0.3, 0.38, 1) : t === "ec" ? new THREE.Vector3(0.75, 0.32, 1) : new THREE.Vector3(0.3, 0.32, 1);
        const part = kind === "hanger" ? buildHanger(currentTee as HangerType, currentTeeSizes[0], sheet, refMats, rodMat, rodMat) : buildCap(t, currentTeeSizes[0], sheet, refMats, seam, screwMat);
        moving = part.moving.map((m) => ({ ...m, base: m.obj.position.x }));
        screws = part.screws.items;
        stopPlay();
        part.group.updateMatrixWorld(true);
        const box = new THREE.Box3();
        // Frame on the solid part and the reference pieces alike (the whole scene must stay in view while it spins).
        box.setFromObject(part.group);
        const holder = new THREE.Group();
        holder.add(part.group);
        part.group.position.sub(box.getCenter(new THREE.Vector3()));
        model = new THREE.Group();
        model.add(holder);
        scene.add(model);
        spangle.repeat.set(Math.max(2, Math.round((Math.PI * d) / 10)), TEX_LENGTH / 10);
        frame(d);
        return;
      }
      const solid: Mats = { metal, inside, seam };
      if (kind === "wye" || kind === "os") {
        // Wyes: the connection goes on every end, each its own size (reducing legs: the small end), all played at once.
        // Offset: both ends; square to round: the round end only.
        const w = kind === "os" ? buildOs(currentTee as OsType, currentTeeSizes, solid, style) : buildWye(currentTee as WyeType, currentTeeSizes, solid, style);
        const joints = c === "none" ? [] : w.ends.map((f, i) => (c === "coupling" ? slipJoint(w.sizes[i], f, pipeMats, screwMat) : flangeJoint(w.sizes[i], f, pipeMats, metal, sheet, gasketMat, screwMat)));
        moving = joints.flatMap((j) => j.moving.map((m) => ({ ...m, base: m.obj.position.x })));
        screws = joints.flatMap((j) => j.screws.items);
        stopPlay();
        w.group.updateMatrixWorld(true);
        w.group.position.sub(new THREE.Box3().setFromObject(w.group).getCenter(new THREE.Vector3()));
        model = new THREE.Group();
        model.add(w.group);
        scene.add(model);
        spangle.repeat.set(Math.max(2, Math.round((Math.PI * d) / 10)), TEX_LENGTH / 10);
        frame(d);
        return;
      }
      const { group: elbow, ends } =
        kind === "tee"
          ? buildCross(currentTee as TeeType, currentTeeSizes, solid, style)
          : kind === "ctee"
          ? buildConeCross(currentTee as CteeType, currentTeeSizes, solid, style)
          : kind === "lat"
          ? buildLateral(currentTee as LatType, currentTeeSizes, solid, style)
          : kind === "tap"
          ? buildTap(currentTee as TapType, currentTeeSizes, solid, style, refMats, plateMat)
          : kind === "ltap"
          ? buildLateralTap(currentTee as LtapType, currentTeeSizes, solid, style, refMats, plateMat)
          : kind === "red"
          ? buildReducer(currentTee as RedType, currentTeeSizes, solid, style)
          : kind === "me90"
          ? buildMitered(d, v > 0 ? ghostMats : solid, style, v, vaneMat, vaneEdge)
          : kind === "bt90"
            ? buildTee(d, Math.min(currentB, d), Math.min(currentRunC, d), v > 0 ? ghostMats : solid, style, v, vaneMat, vaneEdge)
            : buildElbow(d, solid, style, kind);
      // The bottom end reads best on a phone: the duct hangs straight down under the elbow, in the tall screen.
      // (reducers: on the small B end, so that size)
      const jd = kind === "red" ? currentTeeSizes[1] : d;
      const joint = c === "coupling" ? slipJoint(jd, ends[0], pipeMats, screwMat) : c === "flange" ? flangeJoint(jd, ends[0], pipeMats, metal, sheet, gasketMat, screwMat) : null;
      moving = joint ? joint.moving.map((m) => ({ ...m, base: m.obj.position.x })) : [];
      screws = joint ? joint.screws.items : [];
      stopPlay();
      // Elbows: bottom end on the left, other end out to the right, as drawn on the sheet. Tee: B left, C right, as drawn.
      elbow.rotation.y = kind === "bt90" || kind === "tee" || kind === "ctee" || kind === "lat" || kind === "tap" || kind === "ltap" || kind === "red" ? 0 : Math.PI;
      elbow.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(elbow).getCenter(new THREE.Vector3());
      elbow.position.sub(center);
      model = new THREE.Group();
      model.add(elbow);
      scene.add(model);
      spangle.repeat.set(Math.max(2, Math.round((Math.PI * d) / 10)), TEX_LENGTH / 10);
      frame(d);
    };

    const resize = () => {
      W = el.clientWidth || 1;
      H = el.clientHeight || 1;
      renderer.setSize(W, H, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      project();
    };
    let currentTee: string = teeType0;
    let currentTeeSizes: readonly number[] = fam[teeType0].defaults;
    let currentD = kind === "tee" || kind === "ctee" || kind === "lat" || kind === "tap" || kind === "ltap" || kind === "red" || kind === "cap" || kind === "wye" || kind === "hanger" ? currentTeeSizes[0] : kind === "os" ? osDims(currentTee as OsType, currentTeeSizes).gaugeD : spec.defaultD;
    let currentC: Connection = "none";
    let currentV = 0;
    let currentB = TEE_RUN_DEFAULT;
    let currentRunC = TEE_RUN_DEFAULT;
    resize();
    build(currentD, currentC, currentV);
    const ro = new ResizeObserver(() => {
      resize();
      frame(currentD);
    });
    ro.observe(el);

    api.current = {
      setDiameter: (d) => {
        if (d === currentD) return;
        currentD = d;
        build(currentD, currentC, currentV);
      },
      setConnection: (c) => {
        if (c === currentC) return;
        currentC = c;
        build(currentD, currentC, currentV);
      },
      setVanes: (n) => {
        if (n === currentV) return;
        currentV = n;
        build(currentD, currentC, currentV);
      },
      setRun: (b, c) => {
        if (b === currentB && c === currentRunC) return;
        currentB = b;
        currentRunC = c;
        build(currentD, currentC, currentV);
      },
      setCross: (type, sizes) => {
        if (type === currentTee && sizes.length === currentTeeSizes.length && sizes.every((x, i) => x === currentTeeSizes[i])) return;
        currentTee = type;
        currentTeeSizes = sizes;
        currentD = kind === "os" ? osDims(type as OsType, sizes).gaugeD : sizes[0];
        build(currentD, currentC, currentV);
      },
      setTopInset: (px) => {
        if (Math.abs(px - inset) < 1) return;
        inset = px;
        frame(currentD);
      },
      reset: () => {
        stopPlay();
        frame(currentD);
        controls.autoRotate = true;
      },
      play: togglePlay,
    };

    renderer.setAnimationLoop((now) => {
      stepPlay(now);
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      api.current = null;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      if (model) disposeGroup(model);
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      [metal, seam, inside, sheet, screwMat, gasketMat, ...Object.values(ghostMats), ...new Set(Object.values(refMats)), plateMat, vaneMat, vaneEdge, rodMat].forEach((m) => m.dispose());
      [spangle, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  // Run sizes (clamped to A in the same change as A; the model then rebuilds with the new A).
  useEffect(() => {
    api.current?.setRun(runB, runC);
  }, [runB, runC]);
  useEffect(() => {
    api.current?.setDiameter(diameter);
  }, [diameter]);
  useEffect(() => {
    api.current?.setCross(teeType, teeSizes);
  }, [teeType, teeSizes]);
  useEffect(() => {
    api.current?.setConnection(connection);
  }, [connection]);
  // Diameter first, then vanes (both effects run on a size change; the vane count follows the new size).
  const vaneN = vanes?.n ?? 0;
  useEffect(() => {
    api.current?.setVanes(vaneN);
  }, [vaneN]);
  // Keep the model clear of the caption card at the top of the view.
  useLayoutEffect(() => {
    const c = caption.current;
    const h = host.current;
    if (!c || !h) return;
    const measure = () => api.current?.setTopInset(Math.max(0, c.getBoundingClientRect().bottom - h.getBoundingClientRect().top));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    ro.observe(h);
    return () => ro.disconnect();
  }, [connection, failed]);
  const tee = kind === "bt90";
  const teeSpec = fam[teeType];
  const tapSpec = taps ? tapFam[teeType] : null;
  const tapD = taps && !ltaps ? tapDims(teeType as TapType, teeSizes) : null;
  const ltapD = ltaps ? ltapDims(teeType as LtapType, teeSizes) : null;
  const redD = reds ? redDims(teeType as RedType, teeSizes) : null;
  const capD = caps ? capDims(teeType as CapType, teeSizes[0]) : null;
  const wyeD = wyes ? wyeDims(teeType as WyeType, teeSizes) : null;
  const dims: { L: number; R: number; reducing: boolean; Lx?: number } = redD
    ? { L: 0, R: redD.R, reducing: true }
    : caps || wyes || oss || hangers
    ? { L: 0, R: 0, reducing: false }
    : conical
    ? cteeDims(teeType as CteeType, teeSizes)
    : ltapD
    ? { L: ltapD.L, Lx: ltapD.Lx, R: 0, reducing: false }
    : taps
    ? { L: 0, R: 0, reducing: false }
    : lateral
    ? latDims(teeType as LatType, teeSizes)
    : teeDims(teeType as TeeType, teeSizes);
  const bound = (i: number) => teeSpec.bound?.[i] ?? 0;
  /** Largest size select i may take, given the others (taps: A up to P - gap; else up to its bound, A unlimited). */
  const maxSize = (i: number, s: readonly number[]) => (tapSpec ? (i === 0 ? s[1] - tapSpec.gap : Infinity) : i === 0 ? Infinity : reds ? s[0] - 1 : s[bound(i)]);
  const name = hangers ? teeSpec.name : cross ? `${teeSpec.name} (${teeSpec.code})` : vanes ? (tee ? "Bullhead Tee 90° (BTV90)" : "Mitered 90° Elbow (MEV90)") : spec.name;
  const info =
    cross
      ? connection !== "none"
        ? (oss ? (teeType === "sq2rd" ? SQ2RD_CONNECTION_INFO : OS_CONNECTION_INFO) : wyes ? WYE_CONNECTION_INFO : reds ? RED_CONNECTION_INFO : ltaps ? LTAP_CONNECTION_INFO : taps ? TAP_CONNECTION_INFO : CROSS_CONNECTION_INFO)[connection]
        : { title: name, text: teeSpec.text }
      : connection !== "none"
      ? tee
        ? TEE_CONNECTION_INFO[connection]
        : ELBOW_CONNECTION_INFO[connection]
      : vanes
        ? tee
          ? {
              title: "Bullhead Tee 90° w/ Vanes (BTV90)",
              text: `${vanes.n} curved splitter vanes each side, turning the branch flow out both ways (${vanes.n} for A = ${vanes.range}, assumed). Walls shown see-through.`,
            }
          : { title: "Mitered 90° Elbow w/ Vanes (MEV90)", text: `${vanes.n} curved turning vanes along the miter, across the full duct (${vanes.n} for ${vanes.range}). Walls shown see-through.` }
        : spec.none;
  const teeL = diameter + TEE_EXTRA;
  const rB = reducerLength(diameter, runB);
  const rC = reducerLength(diameter, runC);
  /** Pick a tee/cross type: its default sizes, and the link in the address bar follows (no new history step). */
  const pickType = (t: string) => {
    if (t === teeType) return;
    setTeeType(t);
    setTeeSizes(fam[t].defaults);
    if (hangers) {
      if (location.hash.startsWith(SWF_HANGER_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + hangerHash(t as HangerType));
    } else if (oss) {
      if (location.hash.startsWith(SWF_OS_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + osHash(t as OsType));
    } else if (wyes) {
      if (location.hash.startsWith(SWF_WYE_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + wyeHash(t as WyeType));
    } else if (caps) {
      if (location.hash.startsWith(SWF_CAP_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + capHash(t as CapType));
    } else if (reds) {
      if (location.hash.startsWith(SWF_RED_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + redHash(t as RedType));
    } else if (ltaps) {
      if (location.hash.startsWith(SWF_LTAP_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + ltapHash(t as LtapType));
    } else if (taps) {
      if (location.hash.startsWith(SWF_TAP_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + tapHash(t as TapType));
    } else if (lateral) {
      if (location.hash.startsWith(SWF_LAT_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + latHash(t as LatType));
    } else if (conical) {
      if (location.hash.startsWith(SWF_CTEE_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + cteeHash(t as CteeType));
    } else if (location.hash.startsWith(SWF_TEE_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + teeHash(t as TeeType));
  };
  // Set one size, then keep each later size within its bound (A, or the top tap for a conical cross's bottom tap).
  const setTeeSize = (i: number, d: number) =>
    setTeeSizes((s) => {
      const n = s.map((x, k) => (k === i ? d : x));
      if (tapSpec) {
        // A up to P - gap, at least the smallest size (P's list only offers pipes that leave room for one)
        n[0] = Math.max(spec.sizes[0], ...spec.sizes.filter((x) => x <= Math.min(n[0], n[1] - tapSpec.gap)));
        return n;
      }
      if (oss) {
        // OS: the offset up to A. SQ2RD: the round A up to the smaller of H and W (largest stock size that fits).
        if (teeType === "os") n[1] = Math.min(n[1], n[0]);
        else n[2] = Math.max(spec.sizes[0], ...spec.sizes.filter((x) => x <= Math.min(n[0], n[1], n[2])));
        return n;
      }
      if (reds) {
        // B stays below A (A's list starts one size up, so there is always one)
        n[1] = Math.max(spec.sizes[0], ...spec.sizes.filter((x) => x < n[0] && x <= n[1]));
        return n;
      }
      for (let k = 1; k < n.length; k++) n[k] = Math.min(n[k], n[bound(k)]);
      return n;
    });
  const resetButton = (
        <button
          type="button"
          onClick={() => api.current?.reset()}
          className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]"
          aria-label="Reset view"
        >
          <RotateCcw className="size-5" />
        </button>
  );
  const setA = (a: number) => {
    setDiameter(a);
    setRunB((b) => Math.min(b, a));
    setRunC((c) => Math.min(c, a));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]"
      role="dialog"
      aria-modal="true"
      aria-label={spec.aria}
    >
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Single Wall Round · {name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full bg-white/15 active:bg-white/25"
          aria-label="Close 3D model"
        >
          <X className="size-6" />
        </button>
      </header>
      <div ref={host} className="relative min-h-0 flex-1">
        {failed && (
          <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted">
            3D isn&apos;t available on this device (WebGL is turned off or not supported).
          </p>
        )}
        {!failed && (
          <div
            ref={caption}
            className="pointer-events-none absolute inset-x-3 top-3 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:inset-x-auto short:left-3 short:py-1"
            aria-live="polite"
            data-testid="connection-caption"
          >
            <p className="font-display text-lg leading-tight text-accent">{info.title}</p>
            <p className="text-xs leading-snug text-ink short:hidden">{info.text}</p>
          </div>
        )}
        {hint && !failed && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-steel">
            Drag to turn · pinch to zoom
          </p>
        )}
      </div>
      {caps || hangers ? (
        // Sheet 10 parts and sheet 13 hangers are the connection themselves: no Coupling / Flange buttons, just Play to put the part on.
        <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2.5 short:pt-1.5">
          <div className="grid h-9 grid-cols-3 items-end gap-2 short:h-8">
            <span className="col-span-2 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">How it goes on</span>
            {!failed && (
              <button
                type="button"
                onClick={() => api.current?.play()}
                aria-label={play === "playing" ? "Pause" : play === "done" ? "Replay how it goes together" : "Play how it goes together"}
                className="btn-raised btn-raised-sm mb-1 flex h-8 items-center justify-center gap-1.5 rounded-[0.65rem] font-display text-base leading-none short:h-7"
              >
                {play === "playing" ? (
                  <Pause className="size-4" aria-hidden="true" />
                ) : play === "done" ? (
                  <RotateCw className="size-4" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {play === "playing" ? "Pause" : play === "done" ? "Replay" : "Play"}
              </button>
            )}
          </div>
        </div>
      ) : (
      <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2.5 short:pt-1.5" role="radiogroup" aria-label="Connection">
        {/* Label row; the Play button sits in the right column, over Flange (same as the duct). */}
        <div className="grid h-9 grid-cols-3 items-end gap-2 short:h-8">
          <span className="col-span-2 text-[11px] font-medium tracking-wide text-muted uppercase">Connection</span>
          {connection !== "none" && !failed && (
            <button
              type="button"
              onClick={() => api.current?.play()}
              aria-label={play === "playing" ? "Pause" : play === "done" ? "Replay how it goes together" : "Play how it goes together"}
              className="btn-raised btn-raised-sm mb-1 flex h-8 items-center justify-center gap-1.5 rounded-[0.65rem] font-display text-base leading-none short:h-7"
            >
              {play === "playing" ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : play === "done" ? (
                <RotateCw className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {play === "playing" ? "Pause" : play === "done" ? "Replay" : "Play"}
            </button>
          )}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {CONNECTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={connection === c.id}
              onClick={() => setConnection(c.id)}
              className="btn-raised btn-raised-sm h-10 rounded-[0.65rem] font-display text-lg leading-none short:h-8"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      )}
      {hasVanes && (
        // Turning vanes (MEV90 / BTV90), separate from the connection. Made from 8" up (sheet's table).
        <div className="grid grid-cols-3 items-center gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label="Turning vanes">
          <span className="text-[11px] leading-tight font-medium tracking-wide text-muted uppercase">
            Vanes
            {diameter < VANES_FROM && <span className="block tracking-normal normal-case">Vanes from {VANES_FROM}&Prime;</span>}
          </span>
          {([false, true] as const).map((on) => (
            <button
              key={String(on)}
              type="button"
              role="radio"
              aria-checked={on ? !!vanes : !vanes}
              disabled={on && diameter < VANES_FROM}
              aria-label={on ? "Vanes on" : "Vanes off"}
              onClick={() => setVanesOn(on)}
              className="btn-raised btn-raised-sm h-9 rounded-[0.65rem] font-display text-lg leading-none disabled:opacity-45 short:h-8"
            >
              {on ? "On" : "Off"}
            </button>
          ))}
        </div>
      )}
      {cross ? (
        <>
          {/* Tees & crosses: the type picker (sheet's four), then that type's sizes (A first; taps and outlet up to A). */}
          <div className={`grid ${ltaps || reds || wyes || oss || hangers ? "grid-cols-2" : caps ? "grid-cols-5" : "grid-cols-4"} gap-2 bg-surface/90 px-3 pt-2`} role="radiogroup" aria-label={hangers ? "Hanger type" : oss ? "Offset or transition type" : wyes ? "Wye type" : caps ? "Part type" : reds ? "Reducer type" : ltaps ? "Lateral tap type" : taps ? "Tap type" : lateral ? "Lateral type" : conical ? "Conical tee or cross type" : "Tee or cross type"}>
            {(hangers ? HANGER_TYPES : oss ? OS_TYPES : wyes ? WYE_TYPES : caps ? CAP_TYPES : reds ? RED_TYPES : ltaps ? LTAP_TYPES : taps ? TAP_TYPES : lateral ? LAT_TYPES : conical ? CTEE_TYPES : TEE_TYPES).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={teeType === t}
                aria-label={hangers ? fam[t].name : `${fam[t].name} (${fam[t].code})`}
                onClick={() => pickType(t)}
                className={`btn-raised btn-raised-sm min-w-0 rounded-[0.65rem] px-1 font-display text-lg leading-none ${taps || reds || caps || wyes || oss || hangers ? "flex h-11 flex-col items-center justify-center gap-0.5 short:h-9" : "h-9 short:h-8"}`}
              >
                {fam[t].code}
                {/* taps: the sheet calls both conical ones CT90, so each button also says saddle or tap */}
                {(taps || reds || caps || wyes || oss || hangers) && (
                  <span className={`font-sans text-[10px] leading-none font-medium uppercase opacity-75 ${caps ? "tracking-normal" : "tracking-wider"}`}>
                    {hangers ? HANGERS[t as HangerType].short : oss ? OSS[t as OsType].short : wyes ? WYES[t as WyeType].short : caps ? CAPS[t as CapType].short : reds ? REDS[t as RedType].short : tapFam[t].short}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 bg-surface/90 px-3 pt-2" data-testid="cross-sizes">
            {teeSpec.labels.map((label, i) => (
              <label key={`${teeType}-${label}`} className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
                <select
                  value={teeSizes[i]}
                  onChange={(e) => setTeeSize(i, Number(e.target.value))}
                  aria-label={`Size ${label.replace(" · ", " (") + ")"}`}
                  className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
                >
                  {(osD
                    ? osD.type === "os"
                      ? i === 0
                        ? spec.sizes
                        : Array.from({ length: osD.a }, (_, k) => k + 1)
                      : i < 2
                      ? RECT_SIZES
                      : spec.sizes.filter((d) => d <= Math.min(osD.h, osD.w))
                    : tapSpec && i === 1
                    ? spec.sizes.filter((d) => d >= spec.sizes[0] + tapSpec.gap)
                    : reds && i === 0
                    ? spec.sizes.filter((d) => d > spec.sizes[0])
                    : spec.sizes.filter((d) => d <= maxSize(i, teeSizes))
                  ).map((d) => (
                    <option key={d} value={d}>
                      {d}&Prime;
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface/90 px-3 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="min-w-0 flex-1 text-xs leading-snug text-ink" data-testid="cross-info">
              {hangerD ? (
                <>
                  <p className="truncate">
                    <b className="font-semibold">{hangerD.w === 1 ? "1" : "1½"}&Prime; × {hangerD.ga} ga</b> strap · ears <b className="font-semibold">{EAR}&Prime;</b> ·{" "}
                    <b className="font-semibold">7/16&Prime;</b> holes
                  </p>
                  <p className="truncate text-muted" data-testid="rod-note">
                    Order by pipe size · threaded rod not included
                  </p>
                </>
              ) : osD ? (
                osD.type === "os" ? (
                  <>
                    <p className="truncate">
                      <b className="font-semibold">{gauge.fitting} ga</b> fitting · L = <b className="font-semibold">{osD.L}&Prime;</b> · offset{" "}
                      <b className="font-semibold">{osD.offset}&Prime;</b>
                    </p>
                    <p className="truncate text-muted">
                      {spec.note} · L = A × 2 · overall {osD.L + 2 * COLLAR}&Prime;
                    </p>
                  </>
                ) : (
                  <>
                    <p className="truncate">
                      <b className="font-semibold">{gauge.fitting} ga</b> fitting · L = <b className="font-semibold">{osD.L}&Prime;</b>
                      {osD.assumed ? " · assumed" : ""} · table A <b className="font-semibold">{osD.diff}&Prime;</b>
                    </p>
                    <p className="text-muted" data-testid="sq2rd-note">
                      Table &ldquo;A&rdquo; = larger of H/W − round A, not the round size
                    </p>
                  </>
                )
              ) : wyeD ? (
                <>
                  <p className="truncate">
                    <b className="font-semibold">{gauge.fitting} ga</b> fitting · legs 45°
                    {wyeD.type === "ry45" ? (
                      <>
                        {" "}
                        · R = <b className="font-semibold">{inches(wyeD.RB)}&Prime;</b> (B) / <b className="font-semibold">{inches(wyeD.RC)}&Prime;</b> (C)
                      </>
                    ) : (
                      <>
                        {" "}
                        · all ends <b className="font-semibold">{wyeD.a}&Prime;</b>
                      </>
                    )}
                  </p>
                  <p className="truncate text-muted">
                    {spec.note} · {wyeD.type === "ry45" ? `R by the reducer table${wyeD.past ? " · assumed" : ""}` : `gored body · ${COLLAR}″ ends`}
                  </p>
                </>
              ) : capD ? (
                <>
                  <p className="truncate">
                    <b className="font-semibold">{gauge.fitting} ga</b> fitting ·{" "}
                    {capD.type === "bm" ? (
                      <>
                        B = <b className="font-semibold">{capD.b}&Prime;</b> · H = <b className="font-semibold">{BM_H}&Prime;</b>
                      </>
                    ) : capD.type === "sc" ? (
                      <>
                        collar <b className="font-semibold">{CAP_LEN}&Prime;</b> · flange <b className="font-semibold">{capD.flange}&Prime;</b> OD
                      </>
                    ) : capD.type === "ec" ? (
                      <>
                        disc <b className="font-semibold">{capD.a}&Prime;</b>
                      </>
                    ) : (
                      <>
                        band <b className="font-semibold">{capD.a}&Prime;</b> × <b className="font-semibold">{CAP_LEN}&Prime;</b>
                      </>
                    )}
                  </p>
                  <p className="truncate text-muted">
                    {spec.note} ·{" "}
                    {capD.type === "pc"
                      ? "pipe to pipe · bead stop"
                      : capD.type === "fc"
                      ? "fitting to fitting · dimple stop"
                      : capD.type === "ec"
                      ? "into the pipe end"
                      : capD.type === "sc"
                      ? "1″ flange · on a wall"
                      : `B = A + ${2 * BM_FLARE}″ · order by A`}
                  </p>
                </>
              ) : redD ? (
                <>
                  <p className="truncate">
                    <b className="font-semibold">{gauge.fitting} ga</b> fitting · R = <b className="font-semibold">{inches(redD.R)}&Prime;</b> · reduction{" "}
                    <b className="font-semibold">{redD.drop}&Prime;</b>
                  </p>
                  <p className="truncate text-muted">
                    {spec.note} ·{" "}
                    {redD.ecc ? REDS.er.rRule : `A − B ${redD.R - 3}–${redD.R}″ → R ${redD.R}″${redD.past ? " · assumed" : ""}`}
                  </p>
                </>
              ) : tapSpec && ltapD ? (
                <>
                  <p className="truncate">
                    <b className="font-semibold">{gauge.fitting} ga</b> fitting · L = <b className="font-semibold">{inches(ltapD.L)}&Prime;</b>
                    <span className="text-muted"> ({ltapD.Lx.toFixed(2)}&Prime;)</span>
                    {ltapD.saddle && <> · saddle +{TAP_SADDLE}&Prime;</>}
                  </p>
                  <p className="truncate text-muted">
                    {spec.note} · L = {tapSpec.lRule} · {tapSpec.install}
                  </p>
                </>
              ) : tapSpec && tapD ? (
                <>
                  <p className="truncate">
                    <b className="font-semibold">{gauge.fitting} ga</b> fitting · H = <b className="font-semibold">{TAP_H}&Prime;</b>
                    {tapD.cone && (
                      <>
                        {" "}
                        · base <b className="font-semibold">{inches(tapD.base)}&Prime;</b>
                      </>
                    )}
                    {tapD.plate && (
                      <>
                        {" "}
                        · saddle +{TAP_SADDLE}&Prime;
                      </>
                    )}
                  </p>
                  <p className="truncate text-muted">
                    {spec.note} · {tapSpec.install}
                    {tapD.saddle ? "" : " · no saddle"}
                  </p>
                </>
              ) : (
              <>
              <p className="truncate">
                <b className="font-semibold">{gauge.fitting} ga</b> fitting · L = <b className="font-semibold">{inches(dims.L)}&Prime;</b>
                {dims.Lx !== undefined && <span className="text-muted"> ({dims.Lx.toFixed(2)}&Prime;)</span>}
                {dims.reducing && (
                  <>
                    {" "}
                    · R = <b className="font-semibold">{inches(dims.R)}&Prime;</b>
                  </>
                )}
              </p>
              <p className="truncate text-muted">
                {spec.note} · L = {teeSpec.lRule}
              </p>
              </>
              )}
            </div>
            {resetButton}
          </div>
        </>
      ) : tee ? (
        <>
          {/* Bullhead tee sizes: branch A, run outlets B (left) and C (right), each no bigger than A. */}
          <div className="grid grid-cols-3 gap-2 bg-surface/90 px-3 pt-2">
            {(
              [
                ["A · branch", diameter, setA, spec.sizes],
                ["B · left", runB, setRunB, spec.sizes.filter((d) => d <= diameter)],
                ["C · right", runC, setRunC, spec.sizes.filter((d) => d <= diameter)],
              ] as const
            ).map(([label, value, set, sizes]) => (
              <label key={label} className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
                <select
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  aria-label={`Size ${label.replace(" · ", " (") + ")"}`}
                  className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
                >
                  {sizes.map((d) => (
                    <option key={d} value={d}>
                      {d}&Prime;
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface/90 px-3 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="min-w-0 flex-1 text-xs leading-snug text-ink" data-testid="tee-info">
              <p className="truncate">
                <b className="font-semibold">{gauge.fitting} ga</b> fitting · L = <b className="font-semibold">{inches(teeL)}&Prime;</b> · R ={" "}
                <b className="font-semibold">{inches(rB)}&Prime;</b> / <b className="font-semibold">{inches(rC)}&Prime;</b>
              </p>
              <p className={`truncate ${vanes ? "" : "text-muted"}`}>
                {vanes ? (
                  <>
                    Vanes: <b className="font-semibold">{vanes.n}</b> each side ({vanes.range})
                  </>
                ) : (
                  spec.note
                )}
              </p>
            </div>
        <button
          type="button"
          onClick={() => api.current?.reset()}
          className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]"
          aria-label="Reset view"
        >
          <RotateCcw className="size-5" />
        </button>
          </div>
        </>
      ) : (
      <div className="flex items-center gap-2 bg-surface/90 px-3 py-2.5" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <label className="flex max-w-44 min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Diameter</span>
          <select
            value={diameter}
            onChange={(e) => setDiameter(Number(e.target.value))}
            className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-2 font-display text-lg"
          >
            {spec.sizes.map((d) => (
              <option key={d} value={d}>
                {d}&Prime; round
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-[1.3] text-xs leading-snug text-ink">
          {kind === "me90" ? (
            <>
              <p>
                <b className="font-semibold">{gauge.fitting} ga</b> fitting · 2-piece
              </p>
              <p className={vanes ? "" : "text-muted"}>
                {vanes ? (
                  <>
                    Vanes: <b className="font-semibold">{vanes.n}</b> ({vanes.range})
                  </>
                ) : (
                  spec.note
                )}
              </p>
            </>
          ) : (
            <>
              <p>
                <b className="font-semibold">{gauge.fitting} ga</b> fitting · R = <b className="font-semibold">{inches(spec.clr * diameter)}&Prime;</b>
              </p>
              <p className="text-muted">{spec.note}</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => api.current?.reset()}
          className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]"
          aria-label="Reset view"
        >
          <RotateCcw className="size-5" />
        </button>
      </div>
      )}
    </div>
  );
}
