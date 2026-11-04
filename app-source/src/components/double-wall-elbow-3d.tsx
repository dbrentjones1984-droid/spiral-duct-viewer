import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { HomeButton } from "@/components/home-button";
import { ModelSubtitle } from "@/components/model-subtitle";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildFlangeScrews, JOIN_LENGTH, shell, type BuiltConnection } from "@/components/duct-connections";
import { buildPipe, shadowTexture, spangleTexture, type PipeMats } from "@/components/spiral-pipe-3d";
import {
  buildCollar,
  buildTeeVanes,
  buildVanes,
  centerline,
  COLLAR,
  CONE_FLARE,
  CONE_H,
  coneBody,
  ConeSaddleLoop,
  coneTap,
  coneTapGeo,
  CRIMP_TAPER,
  crossBody,
  crossTap,
  CRIMP_X,
  CTEE_EXTRA,
  crimpScrews,
  JointLoop,
  FnCurve,
  saddlePlate,
  TAP_FLARE,
  TAP_H,
  TAP_SADDLE,
  tapShape,
  tapWall,
  type TapShape,
  LAT_EXTRA,
  LAT_FACTOR,
  LAT_STRAIGHT,
  latBody,
  latBranch,
  latS0,
  LatSaddleLoop,
  C45,
  miter,
  MITER_LEG,
  miterLeg,
  MiterLoop,
  piece,
  reducerLength,
  SaddleLoop,
  tangent,
  TEE_BRANCH,
  TEE_EXTRA,
  TEE_RUN_DEFAULT,
  teeBody,
  teeBranch,
  TeeLoop,
  TEX_LENGTH,
  vaneSpec,
  VANES_FROM,
  type Mats,
} from "@/components/gored-elbow-3d";
import {
  buildSection,
  disposeGroup,
  drawWall,
  easeInOut,
  fiberTexture,
  FLANGE_APART,
  FLANGE_T,
  flatRing,
  GASKET_T,
  ringSector,
  SCREW_TURNS,
  segsFor,
  STEP_PAUSE_MS,
  type DwMats,
} from "@/components/double-wall-pipe-3d";
import { DW_LAT_3D_HASH, DW_LAT_TYPES, dwLatHash, type DwLatType, DW_TAP_3D_HASH, DW_TAP_TYPES, dwTapHash, type DwTapType } from "@/lib/route";
import { DW_BULL_3D_HASH, DW_BULL_TYPES, DW_CONE_3D_HASH, DW_CONE_TYPES, DW_ELBOW_3D_HASH, DW_ELBOW_TYPES, DW_INS, DW_MITER_3D_HASH, DW_MITER_TYPES, DW_TEE_3D_HASH, DW_TEE_TYPES, dwBullHash, dwConeHash, dwElbowHash, dwMiterHash, dwTeeHash, type DwBullType, type DwConeType, type DwElbowConn, type DwElbowType, type DwIns, type DwMiterType, type DwTeeType } from "@/lib/route";
import { dwFittingGauge, STOCK_DIAMETERS } from "@/lib/sheets";

/*
 * Interactive 3D model of the double wall round gored elbows (Double Wall Fittings > Round, Brent's Gored Elbows sheet): DE90 90°
 * 5-piece, DE60 60° 3-piece, DE45 45° 3-piece and DE30 30° 2-piece. Same gores as the single wall gored elbow
 * (gored-elbow-3d: end gores tangent at the ends of the turn, middle gores at their middle, a raised seam at each
 * joint), drawn twice: the inner liner at the inside diameter A and the outer shell at A + 2 x insulation, with the
 * insulation between (1", 2" or 3"). Fittings always have a solid liner (Brent: no perforated option). Exterior only,
 * no cutaway (Brent: the fittings do not show the cut out). Each end has a 2" outer collar, and the inner collar sticks
 * out 2" past it.
 * Connections (Brent): Slip Joint works as the single wall one, inner first, then outer: a 12" piece of double wall
 * duct, its outer shell pulled back, slides its liner over the elbow's crimped inner collar up to the bead and is
 * screwed; then its outer shell slides over the crimped outer collar up to that bead and is screwed. Flange works as all
 * the other flanges (the double wall pipe's: one flange ring caps each end, gasket between, screws through both).
 * Assumptions (flagged * in the UI): A is the inside diameter, R = 1.5 x A on the centerline; outer = A + 2 x
 * insulation; gauges from sheet 2 (+2" W.G. fittings column, same for liner and shell); both collars crimped for the
 * slip joint; at a flange the liner runs flush to the flange (no 2" stick-out).
 * The same viewer shows the double wall mitered elbows (family "miter", Brent's Mitered Elbows sheet, printed page 5):
 * DMEV90 and DME90, 90° 2-piece mitered elbows (the single wall ME90's legs, drawn twice, outer shell and liner; each leg
 * runs 4" past the inside corner of the outer shell, 2" collars included), DMEV90 with the single wall MEV90's turning
 * vanes inside the liner, counted by A from the sheet's table (8"-9" 2, 10"-14" 3, 15"-19" 4, 20"-60" 5; none under
 * 8"), seen through the open ends (no cutaway); D3P90, a 90° 3-piece elbow (gores as above, R = 1.5 x A); and D3P90H,
 * the same 3-piece elbow with collar B on top, in line with the lower leg, its outer collar ending 5" above the top of
 * the elbow (sheet). Assumed for D3P90H (*): B round and concentric with the lower leg, B up to A (default about 3/4
 * A), the B outlet starting at the lower gore's seam, ends made like the others (B liner + B + 2 x insulation).
 * And the double wall bullhead tees (family "bullhead", Brent's Bullhead Tees sheet, printed page 6): DBT90 and DBTV90,
 * the single wall BT90 / BTV90 drawn twice (outer shell and liner): a straight body, L = A + 3", with the inlet A
 * coming into its side at 90° (the bottom, as drawn; the single wall tee's 4" branch, 2" collar included), and on each
 * run end a concentric reducer down to B (left) and C (right), R from the reducer sheet (reducerLength(), as the single
 * wall tee), each with a 2" collar. The body is A, as drawn (the single wall rule). DBTV90 adds the single wall BTV90's
 * curved splitter vanes inside the liner (a mirrored pair of sets, counted by A from the MEV90 table, as the single
 * wall tee: an assumption), seen through the open ends (no cutaway). B and C up to A, default 10" (single wall
 * default). Assumed: where the outer inlet (A + 2 x insulation) would not fit in L (2" and 3" insulation), the body is
 * made inlet OD + 1" long (equal to the sheet's L at 1" insulation; the vanes only need the liner, so still fit). The connection plays on the inlet A, as the single wall tee.
 * And the double wall tees & crosses (family "tee", Brent's Tees and Crosses sheet, printed page 7): DT90 tee 90° (A
 * both ends, tap B on top), DRT90 reducing tee 90° (A in, tap C on top, reducer R to outlet B on the right), DC180
 * cross 180° (A both ends, taps B top and C bottom) and DRC180 reducing cross 180° (A in, taps D top and C bottom,
 * reducer R to B): the single wall T90 / RT90 / C180 / RC180 drawn twice (outer shell at A + 2 x insulation with its
 * taps at tap + 2 x insulation, liner at A with its taps at the tap size), the saddle seams on the outer shell, each
 * tap ending 4" out from the main's outer wall in its 2" collar (the single wall tee's TEE_BRANCH, assumed), R from
 * reducerLength() (the reducer sheet, as the single wall tee). L = largest tap + 3" (sheet); the sheet prints DRT90
 * as "L = B + 3"" though its tap is C: the single wall RT90 rule (tap + 3") is used. Assumed: where the outer tap
 * (tap + 2 x insulation) would not fit in L (2" and 3" insulation), the body is made tap OD + 1" long (the same
 * clearance as with 1" insulation, where it equals the sheet's L). Taps up to A, the outlet B smaller than A.
 * And the double wall conical tees & crosses (family "conical", Brent's Conical Tees and Conical Crosses sheet, printed
 * page 8): DCT90 conical tee 90° (A both ends, cone tap B on top, L = B + 5"), DRCT90 reducing conical tee 90° (A in,
 * cone tap C on top, reducer R to outlet B, L = C + 5"), DCC180 conical cross 180° (A both ends, cone taps B top and C
 * bottom) and DRCC180 reducing conical cross 180° (A in, cone taps C top and D bottom, reducer R to B; this sheet puts
 * C on top, the plain tees' sheet puts D there), the crosses L = largest tap + 5" (sheet). The single wall CT90 / RCT90
 * / CC180 / RCC180 drawn twice: each tap's cone runs CONE_H (5", sheet) up from the main's outer wall to its 2" outer
 * collar (the inner collar 2" past it), flaring CONE_FLARE (1") each side along the main (base = tap + 2", the single
 * wall rule, assumed); the outer cone at tap + 2 x insulation, the liner cone at the tap size, both ending at the same
 * height. Assumed: where the outer cone's base (tap + 2 x insulation + 2") would not fit in L (2" and 3" insulation),
 * the body is made base + 1" long (equal to the sheet's L at 1" insulation). Same size limits and defaults as the tees.
 *
 * And the double wall laterals (family "lateral", Brent's Laterals sheet, printed page 9): DL45 lateral 45° (A both
 * ends, 45° branch B on top), DRL45 reducing lateral 45° (A in, branch C on top, reducer R to outlet B), DLC45 lateral
 * cross 45° (A both ends, branches B top and C bottom, B > C) and DRLC45 reducing lateral cross 45° (A in, branches C top
 * and D bottom, reducer R to B, C > D). L = top branch x 1.414 + 3" to the nearest 1/2" (the sheet; its DL45 prints C,
 * read as B, the single wall L45 rule). The single wall lateral drawn twice on one branch axis (through the main's axis,
 * the outer radius back from the centre): each branch LAT_STRAIGHT (2") past the outer main on its short side, the outer
 * at branch + 2 x insulation, the liner at the branch size, both ending at the 2" outer collar (inner collar 2" past
 * it); the seam where the outer branch meets the main. Bottom branch up to the top one (equal allowed, as single wall).
 * Assumed: where the outer branch's footprint (1.414 x (branch + 2 x insulation)) would not fit in L (2" and 3"
 * insulation), the body is made longer by the same 1.414 x 2 x (insulation - 1") (equal to the sheet's L at 1").
 *
 * And the double wall straight & conical taps (family "tap", Brent's Straight Taps and Conical Taps sheet, printed page
 * 11), ordered by B (tap) and P (pipe): DSST90 straight saddle tap, DCT90 conical saddle tap (id dsct90), DST90 straight
 * tap and DCT90 conical tap, saddle not included (id dcnt90); the sheet prints DCT90 for both conical ones. The single
 * wall SST90 / CT90 / ST90 / CT90 drawn twice: 5" tall above the pipe's outer wall (TAP_H, the 2" outer collar included,
 * inner collar 2" past it), the outer at tap + 2 x insulation, the liner at the tap size meeting the pipe's liner, both
 * ending where the outer collar starts; a cone flares 1" each side along the pipe (base tap + 2", the single wall rule,
 * the outer from tap + 2 x insulation, the liner over its own longer height so its base is also tap + 2"); a saddle tap
 * sits on a saddle plate on the pipe's outer wall, 1" past the tap all round (the sheet's 1"). The pipe P (outer shell
 * and liner) is a see-through ghost, for reference. B up to P - 2" (saddles and cones), up to P (DST90), as single wall:
 * insulation adds the same 2 x insulation to the tap and the pipe, so every footprint fits and nothing is lengthened.
 * Units are inches.
 */

type PlayState = "idle" | "playing" | "paused" | "done";
type ScrewItem = NonNullable<BuiltConnection["screws"]>["items"][number];
const DEG = Math.PI / 180;

type Kind = DwElbowType | DwMiterType | DwBullType | DwTeeType | DwConeType | DwLatType | DwTapType;
/** The tees & crosses (sheet 4) and the conical ones (sheet 5): same pickers and rules, straight or cone taps. */
type CrossKind = DwTeeType | DwConeType | DwLatType | DwTapType;
/** gored: gores on R = 1.5 x A; miter: two straight legs on a 45° cut; heel: gored + the B collar on top; tee: bullhead tee; cross: tee / cross; cone: conical tee / cross. */
type Build = "gored" | "miter" | "heel" | "tee" | "cross" | "cone" | "lat" | "tap";
const ELBOW: Record<Kind, { angle: number; pieces: number; name: string; short: string; build: Build; vanes?: boolean; code?: string; sub?: string; saddle?: boolean; cone?: boolean; gap?: number }> = {
  de90: { angle: 90, pieces: 5, name: "Gored 90° Elbow (DE90)", short: "90° 5-piece", build: "gored" },
  de60: { angle: 60, pieces: 3, name: "Gored 60° Elbow (DE60)", short: "60° 3-piece", build: "gored" },
  de45: { angle: 45, pieces: 3, name: "Gored 45° Elbow (DE45)", short: "45° 3-piece", build: "gored" },
  de30: { angle: 30, pieces: 2, name: "Gored 30° Elbow (DE30)", short: "30° 2-piece", build: "gored" },
  dmev90: { angle: 90, pieces: 2, name: "Mitered 90° Elbow w/ Vanes (DMEV90)", short: "90° 2-piece mitered, vanes", build: "miter", vanes: true },
  dme90: { angle: 90, pieces: 2, name: "Mitered 90° Elbow (DME90)", short: "90° 2-piece mitered", build: "miter" },
  d3p90: { angle: 90, pieces: 3, name: "3-Piece 90° Elbow (D3P90)", short: "90° 3-piece", build: "gored" },
  d3p90h: { angle: 90, pieces: 3, name: "3-Piece 90° Elbow, B on Top (D3P90H)", short: "90° 3-piece, collar B on top", build: "heel" },
  dbt90: { angle: 90, pieces: 0, name: "Bullhead Tee 90° (DBT90)", short: "90° bullhead tee", build: "tee" },
  dbtv90: { angle: 90, pieces: 0, name: "Bullhead Tee 90° w/ Vanes (DBTV90)", short: "90° bullhead tee, vanes", build: "tee", vanes: true },
  dt90: { angle: 90, pieces: 0, name: "Tee 90° (DT90)", short: "90° tee", build: "cross" },
  drt90: { angle: 90, pieces: 0, name: "Reducing Tee 90° (DRT90)", short: "90° reducing tee", build: "cross" },
  dc180: { angle: 180, pieces: 0, name: "Cross 180° (DC180)", short: "180° cross", build: "cross" },
  drc180: { angle: 180, pieces: 0, name: "Reducing Cross 180° (DRC180)", short: "180° reducing cross", build: "cross" },
  dct90: { angle: 90, pieces: 0, name: "Conical Tee 90° (DCT90)", short: "90° conical tee", build: "cone" },
  drct90: { angle: 90, pieces: 0, name: "Reducing Conical Tee 90° (DRCT90)", short: "90° reducing conical tee", build: "cone" },
  dcc180: { angle: 180, pieces: 0, name: "Conical Cross 180° (DCC180)", short: "180° conical cross", build: "cone" },
  drcc180: { angle: 180, pieces: 0, name: "Reducing Conical Cross 180° (DRCC180)", short: "180° reducing conical cross", build: "cone" },
  dl45: { angle: 45, pieces: 0, name: "Lateral 45° (DL45)", short: "45° lateral", build: "lat" },
  drl45: { angle: 45, pieces: 0, name: "Reducing Lateral 45° (DRL45)", short: "45° reducing lateral", build: "lat" },
  dlc45: { angle: 45, pieces: 0, name: "Lateral Cross 45° (DLC45)", short: "45° lateral cross", build: "lat" },
  drlc45: { angle: 45, pieces: 0, name: "Reducing Lateral Cross 45° (DRLC45)", short: "45° reducing lateral cross", build: "lat" },
  // Taps (sheet 7): printed codes (DCT90 twice), gap: B up to P - gap.
  dsst90: { angle: 90, pieces: 0, name: "Straight Saddle Tap 90° (DSST90)", short: "straight saddle tap", build: "tap", code: "DSST90", sub: "saddle", saddle: true, cone: false, gap: 2 },
  dsct90: { angle: 90, pieces: 0, name: "Conical Saddle Tap 90° (DCT90)", short: "conical saddle tap", build: "tap", code: "DCT90", sub: "saddle", saddle: true, cone: true, gap: 2 },
  dst90: { angle: 90, pieces: 0, name: "Straight Tap 90°, No Saddle (DST90)", short: "straight tap, no saddle", build: "tap", code: "DST90", sub: "no saddle", saddle: false, cone: false, gap: 0 },
  dcnt90: { angle: 90, pieces: 0, name: "Conical Tap 90°, No Saddle (DCT90)", short: "conical tap, no saddle", build: "tap", code: "DCT90", sub: "no saddle", saddle: false, cone: true, gap: 2 },
};
/**
 * Tees & crosses (sheet 4) and conical tees & crosses (sheet 5): the size selects after A, in letter order, with what
 * each one is (the outlet on the right, the top tap or the bottom tap) and its default (the single wall tee's: outlet
 * 10", taps 8"); and the L rule.
 */
type TeeRole = "out" | "top" | "bottom";
const CROSS: Record<CrossKind, { sizes: readonly { label: string; role: TeeRole; def: number }[]; lRule: string; reducing: boolean }> = {
  dt90: { sizes: [{ label: "B · tap", role: "top", def: 8 }], lRule: "B + 3″", reducing: false },
  drt90: {
    sizes: [
      { label: "B · outlet", role: "out", def: 10 },
      { label: "C · tap", role: "top", def: 8 },
    ],
    lRule: "C + 3″*",
    reducing: true,
  },
  dc180: {
    sizes: [
      { label: "B · top", role: "top", def: 8 },
      { label: "C · bottom", role: "bottom", def: 8 },
    ],
    lRule: "largest tap + 3″",
    reducing: false,
  },
  drc180: {
    sizes: [
      { label: "B · outlet", role: "out", def: 10 },
      { label: "C · bottom", role: "bottom", def: 8 },
      { label: "D · top", role: "top", def: 8 },
    ],
    lRule: "largest tap + 3″",
    reducing: true,
  },
  dct90: { sizes: [{ label: "B · tap", role: "top", def: 8 }], lRule: "B + 5″", reducing: false },
  drct90: {
    sizes: [
      { label: "B · outlet", role: "out", def: 10 },
      { label: "C · tap", role: "top", def: 8 },
    ],
    lRule: "C + 5″",
    reducing: true,
  },
  dcc180: {
    sizes: [
      { label: "B · top", role: "top", def: 8 },
      { label: "C · bottom", role: "bottom", def: 8 },
    ],
    lRule: "largest tap + 5″",
    reducing: false,
  },
  drcc180: {
    sizes: [
      { label: "B · outlet", role: "out", def: 10 },
      { label: "C · top", role: "top", def: 8 },
      { label: "D · bottom", role: "bottom", def: 8 },
    ],
    lRule: "largest tap + 5″",
    reducing: true,
  },
  // Laterals (sheet 6): the single wall laterals' defaults (outlet 10", top 8", bottom 6"); bottom up to top.
  dl45: { sizes: [{ label: "B · branch", role: "top", def: 8 }], lRule: "B × 1.414 + 3″*", reducing: false },
  drl45: {
    sizes: [
      { label: "B · outlet", role: "out", def: 10 },
      { label: "C · branch", role: "top", def: 8 },
    ],
    lRule: "C × 1.414 + 3″",
    reducing: true,
  },
  dlc45: {
    sizes: [
      { label: "B · top", role: "top", def: 8 },
      { label: "C · bottom", role: "bottom", def: 6 },
    ],
    lRule: "B × 1.414 + 3″",
    reducing: false,
  },
  drlc45: {
    sizes: [
      { label: "B · outlet", role: "out", def: 10 },
      { label: "C · top", role: "top", def: 8 },
      { label: "D · bottom", role: "bottom", def: 6 },
    ],
    lRule: "C × 1.414 + 3″",
    reducing: true,
  },
  // Taps (sheet 7): A is the pipe P here; B the tap (the drawing's A), the single wall default 8" on 14".
  dsst90: { sizes: [{ label: "B · tap", role: "top", def: 8 }], lRule: "", reducing: false },
  dsct90: { sizes: [{ label: "B · tap", role: "top", def: 8 }], lRule: "", reducing: false },
  dst90: { sizes: [{ label: "B · tap", role: "top", def: 8 }], lRule: "", reducing: false },
  dcnt90: { sizes: [{ label: "B · tap", role: "top", def: 8 }], lRule: "", reducing: false },
};
const CROSS_KINDS: readonly CrossKind[] = [...DW_TEE_TYPES, ...DW_CONE_TYPES, ...DW_LAT_TYPES, ...DW_TAP_TYPES];
const NO_XS: readonly number[] = [];
/** Largest stock outlet under A (reducing tees / crosses: B < A). */
const maxOutlet = (a: number) => [...STOCK_DIAMETERS].reverse().find((d) => d < a) ?? STOCK_DIAMETERS[0];
/** Keep a tee / cross's sizes in range for main A: taps up to A, the outlet under A. */
const clampCross = (k: CrossKind, a: number, xs: readonly number[]) => {
  const v = CROSS[k].sizes.map((s, i) => Math.min(xs[i] ?? s.def, s.role === "out" ? maxOutlet(a) : Math.max(STOCK_DIAMETERS[0], a - (ELBOW[k].gap ?? 0)))); // a tap never below the smallest stock (P is bumped to fit)
  // Laterals: the bottom branch up to the top one (sheet B > C / C > D; equal allowed, as single wall).
  if (ELBOW[k].build === "lat") {
    const ti = CROSS[k].sizes.findIndex((s) => s.role === "top");
    const bi = CROSS[k].sizes.findIndex((s) => s.role === "bottom");
    if (bi >= 0) v[bi] = Math.min(v[bi], v[ti]);
  }
  return v;
};
/**
 * A tee / cross's outlet (A when not reducing), top and bottom taps (0 = none), the sheet's L (largest tap + 3", or + 5"
 * when conical), the L it is made to (at least the outer tap's footprint + 1": tap OD, or the cone's base tap OD + 2",
 * so the insulated outer tap fits: equal at 1" insulation) and R.
 */
function crossDims(k: CrossKind, A: number, xs: readonly number[], t: number) {
  const get = (r: TeeRole) => {
    const i = CROSS[k].sizes.findIndex((s) => s.role === r);
    return i < 0 ? 0 : (xs[i] ?? CROSS[k].sizes[i].def);
  };
  const out = get("out") || A;
  const top = get("top");
  const bottom = get("bottom");
  const tap = Math.max(top, bottom);
  if (ELBOW[k].build === "tap") return { out, top, bottom, Ls: 0, L: 0, Lx: 0, R: 0 };
  if (ELBOW[k].build === "lat") {
    // Laterals: L = top x 1.414 + 3" to the nearest 1/2"; made longer (same rounding) by 1.414 x 2 x (insulation - 1")
    // where the insulated top branch's footprint would not fit (keeps the sheet's clearance; equal at 1").
    const Lx = top * LAT_FACTOR + LAT_EXTRA;
    const Ls = Math.round(Lx * 2) / 2;
    const L = Math.max(Ls, Math.round((Lx + 2 * LAT_FACTOR * (t - 1)) * 2) / 2);
    return { out, top, bottom, Ls, L, Lx, R: reducerLength(A, out) };
  }
  const cone = ELBOW[k].build === "cone";
  const Ls = tap + (cone ? CTEE_EXTRA : TEE_EXTRA);
  const base = tap + 2 * t + (cone ? 2 * CONE_FLARE : 0);
  return { out, top, bottom, Ls, L: Math.max(Ls, base + 1), Lx: Ls, R: reducerLength(A, out) };
}
/**
 * Bullhead tee body length: the sheet's L = A + 3", or the outer inlet's OD + 1" when that is longer (2" and 3"
 * insulation: the inlet A + 2 x insulation would not fit in A + 3"; equal at 1"). Assumed, as the tees & crosses.
 */
const bullL = (a: number, t: number) => Math.max(a + TEE_EXTRA, a + 2 * t + 1);
/** Bullhead tee outlets B and C: the single wall default (10"), no bigger than A. */
const teeRun = (a: number) => Math.min(TEE_RUN_DEFAULT, a);
const HEEL_H = 5; // D3P90H: B's outer collar ends 5" above the top of the elbow (sheet)
/** D3P90H collar B: the stock size nearest under 3/4 A (as drawn), at least the smallest. Assumed. */
export function defaultB(a: number): number {
  return [...STOCK_DIAMETERS].reverse().find((d) => d <= a * 0.75) ?? STOCK_DIAMETERS[0];
}
const CONN_LABEL: Record<DwElbowConn, string> = { none: "None", slip: "Slip Joint", flange: "Flange" };
const R_FACTOR = 1.5; // sheet 4: R = 1.5 x A
const STICK_OUT = 2; // inner collar past the outer collar (Brent)

/** Play captions (0 = shown apart, before Play; then one per step; the last when assembled). * = assumed. */
const STEPS: Record<Exclude<DwElbowConn, "none">, { title: string; text: string }[]> = {
  slip: [
    { title: "Slip Joint · inner, then outer", text: "Shown apart: the elbow's inner collar sticks out 2″ past its outer collar, both crimped. The duct's outer shell* is pulled back. Press Play." },
    { title: "1 · Inner connects", text: "The duct's inner liner slides over the elbow's crimped inner collar, up to its bead." },
    { title: "2 · Screw the inner", text: "Screws go through the duct liner into the elbow's inner collar." },
    { title: "3 · Outer closes", text: "The duct's outer shell slides over the elbow's crimped outer collar*, up to its bead." },
    { title: "4 · Screw the outer", text: "Screws go through the outer shell into the elbow's outer collar." },
    { title: "Assembled", text: "Same as the single wall slip joint: the inner connects first, then the outer. * assumed" },
  ],
  flange: [
    { title: "Flange · each end capped", text: "Shown apart. The elbow end and the duct end are each capped by one flange ring (outer shell and liner run out to it*); gasket between. Press Play." },
    { title: "1 · Flanges together", text: "The ends meet flange face to face on the gasket." },
    { title: "2 · Screw the flanges", text: "Screws go through both flanges and the gasket." },
    { title: "Assembled", text: "Same as the other flanges: one flange per end, gasket, screws. * assumed" },
  ],
};

/** Gore joints for an elbow of `angle` degrees in `n` pieces: half pieces at the ends, full ones between. */
function seamsFor(angle: number, n: number) {
  const full = angle / (n - 1);
  const s = [0];
  for (let k = 0; k < n - 1; k++) s.push(full / 2 + k * full);
  s.push(angle);
  return s.map((a) => a * DEG);
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
/** Local frame at one end (as gored-elbow-3d endFrame, for any angle): +X out along the axis, origin `out` past the gore. */
function endFrame(end: 0 | 1, theta: number, R: number, out: number) {
  const t = end === 0 ? 0 : theta;
  const dir = tangent(t).multiplyScalar(end === 0 ? -1 : 1);
  const g = new THREE.Group();
  g.position.copy(centerline(t, R)).addScaledVector(dir, out);
  g.quaternion.setFromUnitVectors(X_AXIS, dir);
  return g;
}

type ElbowMats = {
  outer: Mats; // outer shell + outer collars: metal, inside, seam (gore UVs)
  liner: THREE.Material; // liner gores (solid, gore UVs)
  collar: Mats; // inner collars (solid)
  insul: THREE.Material;
  insulCut: THREE.Material;
  flange: THREE.Material;
  vane: THREE.Material; // DMEV90 turning vanes
  vaneEdge: THREE.Material;
  plate: THREE.Material; // tap saddle plates
  ghost: PipeMats; // the pipe a tap goes on: outer shell, see-through
  ghostLiner: PipeMats; // and its liner
};

/**
 * One open end, in its end frame (+X out): None / Slip Joint: outer collar x = -4..-2 (beaded / crimped), inner
 * collar -2..0 (plain / crimped) with the liner carried on through the outer collar, insulation face at x = -2.
 * Flange: both collars plain, x = -2..0, capped by the flange ring at the face (x = -FLANGE_T..0). A = liner size.
 */
function buildEnd(f: THREE.Group, A: number, t: number, conn: DwElbowConn, m: ElbowMats) {
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const bead = Math.min(0.34, 0.04 + OD * 0.012) * 0.8;
  const ib = Math.min(0.34, 0.04 + A * 0.012) * 0.8;
  if (conn === "flange") {
    const oc = buildCollar(OD, "plain", m.outer, bead, radial);
    oc.position.x = -FLANGE_T;
    const ic = buildCollar(A, "plain", m.collar, ib, radial);
    ic.position.x = -FLANGE_T;
    f.add(oc, ic, flatRing(ri - drawWall(OD) * 0.5, ro + (OD <= 12 ? 1.25 : 1.5), -FLANGE_T, 0, segsFor(OD), m.flange, true));
  } else {
    const slip = conn === "slip";
    const oc = buildCollar(OD, slip ? "crimp" : "bead", m.outer, bead, radial);
    oc.position.x = -STICK_OUT;
    const ic = buildCollar(A, slip ? "crimp" : "plain", m.collar, ib, radial);
    f.add(oc, ic);
    // Liner on through the outer collar (inside face), and the insulation's face where the outer collar ends.
    const wall = Math.max(0.05, A * 0.006);
    f.add(new THREE.Mesh(shell([-STICK_OUT - COLLAR, -STICK_OUT], radial, () => ri - wall, 1 / TEX_LENGTH), m.collar.inside));
    const owall = Math.max(0.05, OD * 0.006);
    const rIns = slip ? ro - owall - 0.05 - owall - 0.1 - OD * 0.003 : ro - owall;
    f.add(new THREE.Mesh(ringSector(ri + 0.01, rIns, 0, Math.PI * 2, -STICK_OUT - 0.03, radial), m.insulCut));
  }
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * The elbow: outer shell and (solid) liner, the joint seams, and its ends (end frames as the single wall elbows: end 0
 * at (R, 0) pointing down, end 1 at the end of the turn; D3P90H adds end 2, collar B, pointing up).
 * Gored (DE, D3P90, D3P90H): gores on R = 1.5 x A. Mitered (DMEV90 / DME90): two straight legs meeting on the 45° cut
 * at the corner (R, R), R = the outer shell's radius + 4" - 2" (each leg runs to its outer collar, which ends 4" past
 * the other leg's outer wall), and the vanes (DMEV90) inside the liner.
 */
/**
 * The bullhead tee (DBT90 / DBTV90), in the single wall tee's frame (body along x, inlet A down -y, centre at the
 * origin): body and inlet, outer shell (A + 2 x insulation) and liner (A), the seam where they meet, the vanes
 * (DBTV90), and on each run end the reducer (outer and liner, each over the same R) to B (left) or C (right). ends[0]
 * is the inlet A (the connection plays there), then B and C; +X out of each.
 */
function buildDwTee(A: number, t: number, conn: DwElbowConn, m: ElbowMats, B: number, C: number, vanes: number) {
  const group = new THREE.Group();
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const rib = Math.min(0.34, 0.04 + OD * 0.012);
  const L = bullL(A, t);
  for (const [rr, mat] of [[ro, m.outer.metal], [ri, m.liner]] as const) {
    for (const g of teeBody(rr, L, radial)) group.add(new THREE.Mesh(g, mat));
  }
  // The inlet runs down to its 2" outer collar: TEE_BRANCH below the outer shell, collar included.
  const yTo = ro + TEE_BRANCH - COLLAR;
  group.add(new THREE.Mesh(teeBranch(ro, yTo, radial), m.outer.metal));
  group.add(new THREE.Mesh(teeBranch(ri, yTo, radial), m.liner));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new TeeLoop(ro + rib * 0.35), radial * 2, rib, 8, true), m.outer.seam));
  if (vanes > 0) group.add(buildTeeVanes(A, vanes, m.vane, m.vaneEdge));
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  const fa = new THREE.Group();
  fa.position.set(0, -(yTo + out), 0);
  fa.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, -1, 0));
  buildEnd(fa, A, t, conn, m);
  group.add(fa);
  const ends = [fa];
  const Rs: number[] = [];
  ([
    [-1, B],
    [1, C],
  ] as const).forEach(([side, d]) => {
    const f = dwRunEnd(side, A, d, L, t, conn, m);
    Rs.push(reducerLength(A, d));
    group.add(f);
    ends.push(f);
  });
  return { group, ends, R: 0, OD, L, rB: Rs[0], rC: Rs[1] };
}

/**
 * Run end on side (-1 left, +1 right) of a double wall main A (body length L, centred on the origin): the reducer
 * (outer and liner, each over the same R = reducerLength(A, d), none when d = A) down to d, then the end. Returns the
 * end frame (+X out).
 */
function dwRunEnd(side: -1 | 1, A: number, d: number, L: number, t: number, conn: DwElbowConn, m: ElbowMats) {
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const rib = Math.min(0.34, 0.04 + OD * 0.012);
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  const R = reducerLength(A, d);
  const f = new THREE.Group();
  f.position.set(side * (L / 2 + R + out), 0, 0);
  f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(side, 0, 0));
  if (R > 0) {
    const x0 = -out - R;
    const k = (x: number) => (x - x0) / R;
    const xs = [x0, -out];
    f.add(new THREE.Mesh(shell(xs, radial, (x) => ro + (d / 2 - ri) * k(x), 1 / TEX_LENGTH), m.outer.metal));
    f.add(new THREE.Mesh(shell(xs, radial, (x) => ri + (d / 2 - ri) * k(x), 1 / TEX_LENGTH), m.liner));
    // raised seam where the reducer joins the body (outer shell)
    const tor = new THREE.TorusGeometry(ro + rib * 0.2, rib * 0.8, 8, radial);
    tor.rotateY(Math.PI / 2);
    tor.translate(x0, 0, 0);
    f.add(new THREE.Mesh(tor, m.outer.seam));
  }
  buildEnd(f, d, t, conn, m);
  return f;
}

/**
 * Tee or cross (DT90 / DRT90 / DC180 / DRC180), in the single wall tee's frame (main along x, centre at the origin):
 * the main, outer shell (A + 2 x insulation) and liner (A), open where the taps come in; each tap (outer at tap + 2 x
 * insulation, liner at the tap size) out to 4" past the main's outer wall, 2" outer collar included, its saddle seam
 * on the outer shell; the left A end and the right end (reducer to B on DRT90 / DRC180). ends[0] is the A inlet on the
 * left (the connection plays there), then the right end and the taps; +X out of each.
 */
function buildDwCross(A: number, t: number, conn: DwElbowConn, m: ElbowMats, k: DwTeeType, xs: readonly number[]) {
  const group = new THREE.Group();
  const { out: B, top, bottom, L } = crossDims(k, A, xs, t);
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  for (const g of crossBody(ro, L, radial, top / 2 + t, bottom ? bottom / 2 + t : 0)) group.add(new THREE.Mesh(g, m.outer.metal));
  for (const g of crossBody(ri, L, radial, top / 2, bottom / 2)) group.add(new THREE.Mesh(g, m.liner));
  const ends = [dwRunEnd(-1, A, A, L, t, conn, m), dwRunEnd(1, A, B, L, t, conn, m)];
  ends.forEach((f) => group.add(f));
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  const yTo = ro + TEE_BRANCH - COLLAR; // each tap's shells end where its 2" outer collar starts
  ([
    [1, top],
    [-1, bottom],
  ] as const).forEach(([dir, d]) => {
    if (!d) return;
    const tOD = d + 2 * t;
    const tr = Math.min(144, 64 + Math.round(tOD * 4));
    const rib = Math.min(0.34, 0.04 + tOD * 0.012);
    group.add(new THREE.Mesh(crossTap(tOD / 2, ro, yTo, dir, tr), m.outer.metal));
    group.add(new THREE.Mesh(crossTap(d / 2, ri, yTo, dir, tr), m.liner));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new SaddleLoop(tOD / 2, ro, rib * 0.35, dir), tr * 2, rib, 8, true), m.outer.seam));
    const f = new THREE.Group();
    f.position.set(0, dir * (yTo + out), 0);
    f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, dir, 0));
    buildEnd(f, d, t, conn, m);
    group.add(f);
    ends.push(f);
  });
  return { group, ends, R: 0, OD };
}

/**
 * Conical tee or cross (DCT90 / DRCT90 / DCC180 / DRCC180), laid out as buildDwCross: the main (outer shell and liner,
 * open where the cones come in); each tap a cone CONE_H up from the main's outer wall to its 2" outer collar, flaring
 * CONE_FLARE each side along the main (the single wall conical tee's cone): outer at tap + 2 x insulation, liner at the
 * tap size, both ending at the collar; the seam where the outer cone meets the main and one at its collar; the left A
 * end and the right end (reducer to B on DRCT90 / DRCC180). ends[0] is the A inlet on the left, then the right end and
 * the taps; +X out of each.
 */
function buildDwCone(A: number, t: number, conn: DwElbowConn, m: ElbowMats, k: DwConeType, xs: readonly number[]) {
  const group = new THREE.Group();
  const { out: B, top, bottom, L } = crossDims(k, A, xs, t);
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const yTop = ro + CONE_H; // both cones end where the 2" outer collar starts
  const outerCone = (d: number) => (d ? coneTap(d / 2 + t, yTop) : null);
  const linerCone = (d: number) => (d ? coneTap(d / 2, yTop) : null);
  for (const g of coneBody(ro, L, radial, outerCone(top), outerCone(bottom))) group.add(new THREE.Mesh(g, m.outer.metal));
  for (const g of coneBody(ri, L, radial, linerCone(top), linerCone(bottom))) group.add(new THREE.Mesh(g, m.liner));
  const ends = [dwRunEnd(-1, A, A, L, t, conn, m), dwRunEnd(1, A, B, L, t, conn, m)];
  ends.forEach((f) => group.add(f));
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  ([
    [1, top],
    [-1, bottom],
  ] as const).forEach(([dir, d]) => {
    if (!d) return;
    const tOD = d + 2 * t;
    const tr = Math.min(144, 64 + Math.round(tOD * 4));
    const rib = Math.min(0.34, 0.04 + tOD * 0.012);
    const oc = outerCone(d)!;
    group.add(new THREE.Mesh(coneTapGeo(oc, ro, yTop, dir, tr), m.outer.metal));
    group.add(new THREE.Mesh(coneTapGeo(linerCone(d)!, ri, yTop, dir, tr), m.liner));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new ConeSaddleLoop(oc, ro, rib * 0.35, dir), tr * 2, rib, 8, true), m.outer.seam));
    // seam where the outer cone meets its collar
    const ring = new THREE.TorusGeometry(tOD / 2 + rib * 0.2, rib * 0.8, 8, tr);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, dir * yTop, 0);
    group.add(new THREE.Mesh(ring, m.outer.seam));
    const f = new THREE.Group();
    f.position.set(0, dir * (yTop + out), 0);
    f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, dir, 0));
    buildEnd(f, d, t, conn, m);
    group.add(f);
    ends.push(f);
  });
  return { group, ends, R: 0, OD };
}

/**
 * Lateral or lateral cross (DL45 / DRL45 / DLC45 / DRLC45), as the single wall lateral: the main (outer shell and liner,
 * open where the branches come in) and each 45° branch on one axis from (-outer radius, 0, 0), the outer at branch + 2 x
 * insulation, the liner at the branch size, both ending LAT_STRAIGHT past the outer main on the short side, where the 2"
 * outer collar starts; the seam where the outer branch meets the main; the left A end and the right end (reducer to B
 * on DRL45 / DRLC45). ends[0] is the A inlet on the left, then the right end and the branches; +X out of each.
 */
function buildDwLat(A: number, t: number, conn: DwElbowConn, m: ElbowMats, k: DwLatType, xs: readonly number[]) {
  const group = new THREE.Group();
  const { out: B, top, bottom, L } = crossDims(k, A, xs, t);
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const xc = -ro;
  for (const g of latBody(ro, L, radial, top / 2 + t, bottom ? bottom / 2 + t : 0, xc)) group.add(new THREE.Mesh(g, m.outer.metal));
  for (const g of latBody(ri, L, radial, top / 2, bottom ? bottom / 2 : 0, xc)) group.add(new THREE.Mesh(g, m.liner));
  const ends = [dwRunEnd(-1, A, A, L, t, conn, m), dwRunEnd(1, A, B, L, t, conn, m)];
  ends.forEach((f) => group.add(f));
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  ([
    [1, top],
    [-1, bottom],
  ] as const).forEach(([dir, d]) => {
    if (!d) return;
    const tOD = d + 2 * t;
    const tr = Math.min(144, 64 + Math.round(tOD * 4));
    const rib = Math.min(0.34, 0.04 + tOD * 0.012);
    const sTo = latS0(tOD / 2, ro, Math.PI) + LAT_STRAIGHT;
    group.add(new THREE.Mesh(latBranch(tOD / 2, ro, xc, sTo, dir, tr), m.outer.metal));
    group.add(new THREE.Mesh(latBranch(d / 2, ri, xc, sTo, dir, tr), m.liner));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new LatSaddleLoop(tOD / 2, ro, xc, rib * 0.35, dir), tr * 2, rib, 8, true), m.outer.seam));
    const axis = new THREE.Vector3(C45, dir * C45, 0);
    const f = new THREE.Group();
    f.position.set(xc, 0, 0).addScaledVector(axis, sTo + out);
    f.quaternion.setFromUnitVectors(X_AXIS, axis);
    buildEnd(f, d, t, conn, m);
    group.add(f);
    ends.push(f);
  });
  return { group, ends, R: 0, OD };
}

/**
 * Straight or conical tap (DSST90 / DCT90 saddle / DST90 / DCT90 no saddle) B on a pipe P along x: the single wall tap
 * drawn twice. Outer: tap + 2 x insulation from the pipe's outer wall (or the saddle plate's top) to where its 2" outer
 * collar starts, TAP_H above the pipe's outer wall; liner: the tap size from the pipe's liner up to the same height; a
 * cone flares TAP_FLARE each side at each one's base. Seam where the outer meets the pipe / plate, and where a cone meets
 * its collar; saddle plate on the outer wall. The pipe (outer shell and liner) is a faint see-through reference. ends[0]
 * is the tap's top end, +X up.
 */
function buildDwTap(P: number, t: number, conn: DwElbowConn, m: ElbowMats, k: DwTapType, xs: readonly number[]) {
  const group = new THREE.Group();
  const { top: B } = crossDims(k, P, xs, t);
  const { saddle, cone } = ELBOW[k];
  const rpi = P / 2;
  const rpo = rpi + t;
  const tOD = B + 2 * t;
  const radial = Math.min(144, 64 + Math.round(tOD * 4));
  const rib = Math.min(0.34, 0.04 + tOD * 0.012);
  const th = saddle ? Math.max(0.08, Math.max(0.05, tOD * 0.006) * 1.4) : 0;
  const yTop = rpo + TAP_H - COLLAR; // both end where the 2" outer collar starts
  const rr = rpo + th; // the outer meets the plate's top (or the pipe)
  const outer = tapShape(tOD / 2, yTop, !!cone);
  const hl = yTop - rpi; // the liner's own (longer) height
  const liner: TapShape = cone ? { rt: B / 2, ax: (y) => B / 2 + (TAP_FLARE * (yTop - y)) / hl, slope: -TAP_FLARE / hl } : { rt: B / 2, ax: () => B / 2, slope: 0 };
  group.add(new THREE.Mesh(tapWall(outer, rr, yTop, radial), m.outer.metal));
  group.add(new THREE.Mesh(tapWall(liner, rpi, yTop, radial), m.liner));
  const kk = rib * 0.35;
  group.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new FnCurve((u, target) => {
          const phi = u * Math.PI * 2;
          const z0 = outer.rt * Math.sin(phi);
          const y0 = Math.sqrt(Math.max(0, rr * rr - z0 * z0));
          const z = (outer.rt + kk) * Math.sin(phi);
          const R = rr + kk;
          return target.set((outer.ax(y0) + kk) * Math.cos(phi), Math.sqrt(Math.max(0, R * R - z * z)), z);
        }),
        radial * 2,
        rib,
        8,
        true,
      ),
      m.outer.seam,
    ),
  );
  if (cone) {
    const ring = new THREE.TorusGeometry(tOD / 2 + rib * 0.2, rib * 0.8, 8, radial);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, yTop, 0);
    group.add(new THREE.Mesh(ring, m.outer.seam));
  }
  if (saddle) {
    const foot = (phi: number): [number, number] => {
      const z = outer.rt * Math.sin(phi);
      const y0 = Math.sqrt(Math.max(0, rr * rr - z * z));
      return [outer.ax(y0) * Math.cos(phi), z];
    };
    const plate = saddlePlate(rpo, th, foot, radial);
    for (const g of plate.geos) group.add(new THREE.Mesh(g, m.plate));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(plate.rim, radial * 2, th * 0.75, 6, true), m.outer.seam));
  }
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  const f = new THREE.Group();
  f.position.set(0, yTop + out, 0);
  f.quaternion.setFromUnitVectors(X_AXIS, new THREE.Vector3(0, 1, 0));
  buildEnd(f, B, t, conn, m);
  group.add(f);
  // The pipe P (outer shell and liner): a short see-through length, for reference only.
  const span = tOD + (cone ? 2 * TAP_FLARE : 0) + (saddle ? 2 * TAP_SADDLE : 0);
  const len = Math.max(P + 2 * t + 4, Math.ceil(span) + 8);
  for (const g of [buildPipe(P + 2 * t, m.ghost, len), buildPipe(P, m.ghostLiner, len)]) {
    g.traverse((o) => {
      o.renderOrder = 1;
    });
    group.add(g);
  }
  return { group, ends: [f], R: 0, OD: tOD };
}

function buildDwElbow(A: number, t: number, kind: Kind, conn: DwElbowConn, m: ElbowMats, B: number, C: number, xs: readonly number[]) {
  const { angle, pieces, build, vanes } = ELBOW[kind];
  if (build === "cross") return buildDwCross(A, t, conn, m, kind as DwTeeType, xs);
  if (build === "cone") return buildDwCone(A, t, conn, m, kind as DwConeType, xs);
  if (build === "lat") return buildDwLat(A, t, conn, m, kind as DwLatType, xs);
  if (build === "tap") return buildDwTap(A, t, conn, m, kind as DwTapType, xs);
  if (build === "tee") return buildDwTee(A, t, conn, m, B, C, vanes ? (vaneSpec(A)?.n ?? 0) : 0);
  const group = new THREE.Group();
  const theta = angle * DEG;
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const rib = Math.min(0.34, 0.04 + OD * 0.012);
  let R: number;
  if (build === "miter") {
    R = ro + MITER_LEG - COLLAR;
    const body = new THREE.Group();
    body.position.set(R, R, 0);
    group.add(body);
    const legs = [
      { dir: new THREE.Vector3(0, -1, 0), perp: new THREE.Vector3(1, 0, 0) },
      { dir: new THREE.Vector3(-1, 0, 0), perp: new THREE.Vector3(0, 1, 0) },
    ];
    legs.forEach(({ dir, perp }, i) => {
      body.add(new THREE.Mesh(miterLeg(dir, perp, ro, R, COLLAR * 2 + i * 37, radial), m.outer.metal));
      body.add(new THREE.Mesh(miterLeg(dir, perp, ri, R, COLLAR * 2 + i * 37, radial), m.liner));
    });
    // Seam along the 45° cut (outer shell), raised a little proud, as the single wall ME90.
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new MiterLoop(ro + rib * 0.35), radial, rib, 8, true), m.outer.seam));
    const n = vanes ? (vaneSpec(A)?.n ?? 0) : 0;
    if (n > 0) body.add(buildVanes(A, n, m.vane, m.vaneEdge));
  } else {
    R = R_FACTOR * A;
    const seams = seamsFor(angle, pieces);
    const last = seams.length - 2;
    const tangents = seams.slice(0, -1).map((a, k) => (k === 0 ? 0 : k === last ? theta : (a + seams[k + 1]) / 2));
    let vBase = COLLAR * 2;
    tangents.forEach((tk, k) => {
      const a0 = seams[k];
      const a1 = seams[k + 1];
      const gore = (rr: number, mat: THREE.Material) => group.add(new THREE.Mesh(piece(tk, R, rr, miter(tk, a0, R, rr), miter(tk, a1, R, rr), vBase, radial), mat));
      gore(ro, m.outer.metal);
      gore(ri, m.liner);
      vBase += 2 * R * Math.tan((a1 - a0) / 2) + 3;
    });
    for (let k = 1; k < seams.length - 1; k++) {
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new JointLoop(tangents[k - 1], seams[k], R, ro + rib * 0.35), radial, rib, 8, true), m.outer.seam));
    }
    if (build === "heel") {
      // Collar B straight up from the lower gore's seam, on the lower leg's axis (x = R), to where its 2" outer collar starts.
      const yB = R + ro + HEEL_H - COLLAR;
      const bRadial = Math.min(144, 64 + Math.round((B + 2 * t) * 4));
      for (const [rr, mat] of [[B / 2 + t, m.outer.metal], [B / 2, m.liner]] as const) {
        group.add(new THREE.Mesh(piece(0, R, rr, miter(0, seams[1], R, rr), () => yB, 0, bRadial), mat));
      }
    }
  }
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  const frames = [endFrame(0, theta, R, out), endFrame(1, theta, R, out)];
  if (build === "heel") {
    const f = new THREE.Group();
    f.position.set(R, R + ro + HEEL_H - COLLAR + out, 0);
    f.quaternion.setFromUnitVectors(X_AXIS, Y_AXIS);
    frames.push(f);
  }
  frames.forEach((f, i) => {
    buildEnd(f, i === 2 ? B : A, t, conn, m);
    group.add(f);
  });
  return { group, ends: frames, R, OD };
}

export default function DoubleWallElbow3D({
  onClose,
  family = "gored",
  initialType = family === "miter" ? "dmev90" : family === "bullhead" ? "dbt90" : family === "tee" ? "dt90" : family === "conical" ? "dct90" : family === "lateral" ? "dl45" : family === "tap" ? "dsst90" : "de90",
  initialIns = 1,
  initialConn = "slip",
}: {
  onClose: () => void;
  /** gored: DE90 / DE60 / DE45 / DE30 (sheet 1); miter: DMEV90 / DME90 / D3P90 / D3P90H (sheet 2); bullhead: DBT90 / DBTV90 (sheet 3); tee: DT90 / DRT90 / DC180 / DRC180 (sheet 4); conical: DCT90 / DRCT90 / DCC180 / DRCC180 (sheet 5); lateral: DL45 / DRL45 / DLC45 / DRLC45 (sheet 6). */
  family?: "gored" | "miter" | "bullhead" | "tee" | "conical" | "lateral" | "tap"; // tap: DSST90 / DCT90 / DST90 / DCT90 (sheet 7)
  initialType?: Kind;
  initialIns?: DwIns;
  initialConn?: DwElbowConn;
}) {
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    set: (d: number, t: DwIns, kind: Kind, c: DwElbowConn, b: number, cc: number, xs: readonly number[]) => void;
    setTopInset: (px: number) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [diameter, setDiameter] = useState(family === "tap" ? 14 : 12); // taps: pipe P (single wall default 14")
  const [kind, setKind] = useState<Kind>(initialType);
  const [bDia, setBDia] = useState(() => (family === "bullhead" ? teeRun(12) : defaultB(12)));
  const [cDia, setCDia] = useState(() => teeRun(12)); // bullhead tee outlet C (B is bDia)
  // Tees & crosses (straight or conical): each type's sizes after A (CROSS order), kept while switching types.
  const [crossXs, setCrossXs] = useState(() => Object.fromEntries(CROSS_KINDS.map((k) => [k, CROSS[k].sizes.map((s) => s.def)])) as Record<CrossKind, number[]>);
  const [ins, setIns] = useState<DwIns>(initialIns);
  const [connection, setConnection] = useState<DwElbowConn>(initialConn);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const od = diameter + 2 * ins;
  const gauge = dwFittingGauge(diameter);
  const spec = ELBOW[kind];
  const types: readonly Kind[] = family === "miter" ? DW_MITER_TYPES : family === "bullhead" ? DW_BULL_TYPES : family === "tee" ? DW_TEE_TYPES : family === "conical" ? DW_CONE_TYPES : family === "lateral" ? DW_LAT_TYPES : family === "tap" ? DW_TAP_TYPES : DW_ELBOW_TYPES;
  const bull = family === "bullhead";
  const cross = family === "tee" || family === "conical" || family === "lateral" || family === "tap";
  const taps = family === "tap";
  const conical = family === "conical";
  const lateral = family === "lateral";
  const ck = (cross ? kind : "dt90") as CrossKind;
  const xs = cross ? crossXs[ck] : NO_XS;
  const cd = crossDims(ck, diameter, xs, ins);
  /** Main A for the tees / crosses: the others follow it (taps up to A, outlet under A). */
  const setCrossA = (d: number) => {
    setDiameter(d);
    setCrossXs((all) => Object.fromEntries(CROSS_KINDS.map((k) => [k, clampCross(k, d, all[k])])) as Record<CrossKind, number[]>);
  };
  const teeLs = diameter + TEE_EXTRA; // the sheet's L
  const teeL = bullL(diameter, ins); // as made
  const rB = reducerLength(diameter, bDia);
  const rC = reducerLength(diameter, cDia);
  const vanes = spec.vanes ? vaneSpec(diameter) : null;

  // Follow a deep link change (back / forward).
  useEffect(() => setKind(initialType), [initialType]);
  // A reducing tee / cross needs an outlet under A: the smallest A is the second stock size.
  useEffect(() => {
    if (cross && CROSS[kind as CrossKind]?.reducing && diameter <= STOCK_DIAMETERS[0]) setCrossA(STOCK_DIAMETERS[1]);
    // Taps: P has to take the smallest tap (saddles and cones: B up to P - 2").
    const gap = ELBOW[kind].gap ?? 0;
    if (cross && gap && diameter < STOCK_DIAMETERS[0] + gap) setCrossA(STOCK_DIAMETERS.find((d) => d >= STOCK_DIAMETERS[0] + gap)!);
  }, [cross, kind, diameter]);
  useEffect(() => setIns(initialIns), [initialIns]);
  useEffect(() => setConnection(initialConn), [initialConn]);
  // Keep the address on what is shown (replace, so the back button still closes the model).
  useEffect(() => {
    if (family === "tap") {
      if (location.hash.startsWith(DW_TAP_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwTapHash(kind as DwTapType, ins, connection));
    } else if (family === "lateral") {
      if (location.hash.startsWith(DW_LAT_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwLatHash(kind as DwLatType, ins, connection));
    } else if (family === "conical") {
      if (location.hash.startsWith(DW_CONE_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwConeHash(kind as DwConeType, ins, connection));
    } else if (family === "tee") {
      if (location.hash.startsWith(DW_TEE_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwTeeHash(kind as DwTeeType, ins, connection));
    } else if (family === "bullhead") {
      if (location.hash.startsWith(DW_BULL_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwBullHash(kind as DwBullType, ins, connection));
    } else if (family === "miter") {
      if (location.hash.startsWith(DW_MITER_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwMiterHash(kind as DwMiterType, ins, connection));
    } else if (location.hash.startsWith(DW_ELBOW_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwElbowHash(kind as DwElbowType, ins, connection));
  }, [family, kind, ins, connection]);

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

    // Elbow: the single wall gored elbow's materials (UVs around 0..1, along / TEX_LENGTH).
    const spangleE = spangleTexture();
    const metalE = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangleE, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95 });
    const seamE = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const insideE = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.7, roughness: 0.5, side: THREE.BackSide, envMapIntensity: 0.6 });
    const collarE = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangleE, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85 });
    const linerE = new THREE.MeshStandardMaterial({ color: 0xb4bcc4, map: spangleE, metalness: 0.75, roughness: 0.45, envMapIntensity: 0.7, side: THREE.DoubleSide });
    // Duct piece: the double wall pipe's materials (UVs in inches).
    const spangle = spangleTexture();
    spangle.repeat.set(1 / 10, 1 / 10);
    const fiber = fiberTexture();
    const outer = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangle, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95, side: THREE.DoubleSide });
    const seam = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.3, side: THREE.DoubleSide });
    const insul = new THREE.MeshStandardMaterial({ color: 0xf0b640, map: fiber, metalness: 0, roughness: 0.95, envMapIntensity: 0.55, side: THREE.DoubleSide });
    const insulCut = new THREE.MeshStandardMaterial({ color: 0xd9962a, map: fiber, metalness: 0, roughness: 1, envMapIntensity: 0.45, side: THREE.DoubleSide });
    const linerSolid = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangle, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85, side: THREE.DoubleSide });
    const linerSeam = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.85, roughness: 0.35 });
    const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.8, roughness: 0.24, envMapIntensity: 1.25, side: THREE.DoubleSide });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4, side: THREE.DoubleSide });
    // DMEV90 turning vanes: the single wall MEV90's.
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, map: spangleE, metalness: 0.5, roughness: 0.42, envMapIntensity: 1, side: THREE.DoubleSide });
    const vaneEdge = new THREE.MeshStandardMaterial({ color: 0x5f6b77, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8 });
    // Taps: the saddle plate (same metal, toned down) and the pipe P they go on, faint and see-through (reference only).
    const plateMat = metalE.clone();
    plateMat.color.set(0xc9d0d8);
    plateMat.envMapIntensity = 0.7;
    const see = (mt: THREE.MeshStandardMaterial, opacity: number) => {
      const g = mt.clone();
      g.transparent = true;
      g.opacity = opacity;
      g.depthWrite = false;
      return g;
    };
    const ghost: PipeMats = { metal: see(metalE, 0.16), inside: see(insideE, 0.08), seam: see(seamE, 0.22), rim: see(seamE, 0.6) };
    const ghostLiner: PipeMats = { metal: see(linerE, 0.12), inside: see(insideE, 0.06), seam: see(seamE, 0.16), rim: see(seamE, 0.5) };
    const allMats = [metalE, seamE, insideE, collarE, linerE, vaneMat, vaneEdge, outer, seam, edge, insul, insulCut, linerSolid, linerSeam, couplingMat, screwMat, gasketMat, plateMat, ...Object.values(ghost), ...Object.values(ghostLiner)];

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    // Spins like the single wall elbow until you drag.
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

    let model: THREE.Group | null = null;
    const view = new THREE.Vector3(0.3, 0.32, 1);
    // Same framing as the single wall elbow: the whole turning circle stays in view while it spins.
    const frame = (d: number) => {
      if (!model) return;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const spin = Math.hypot(size.x, size.z) / 2;
      shadow.scale.set(spin * 2.3, spin * 2.3, 1);
      shadow.position.set(0, box.min.y - 0.05, 0);
      const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const halfW = spin * 1.12;
      const halfH = (size.y / 2) * 1.08;
      const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.04 + d / 4;
      camera.position.copy(view.clone().normalize().multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.minDistance = d * 0.9;
      controls.maxDistance = dist * 2.2;
      camera.near = Math.max(0.1, d * 0.05);
      camera.far = dist * 6;
      project();
      controls.update();
    };

    // ---- Play: the double wall pipe's step list (moves along each part's end-frame X, or a set of screws), one
    // caption per step.
    type Step = { ms: number; cap: number; moves?: { obj: THREE.Object3D; delta: number }[]; screws?: ScrewItem[] };
    let steps: Step[] = [];
    let bases = new Map<THREE.Object3D, number>();
    let allScrews: ScrewItem[] = [];
    let playMs = 0;
    let doneCap = 0;
    let playT = 0;
    let playing = false;
    let lastTime = 0;
    let shownCap = -1;
    const showCap = (c: number) => {
      if (c !== shownCap) {
        shownCap = c;
        setStep(c);
      }
    };
    const pose = (t: number | null) => {
      const off = new Map<THREE.Object3D, number>();
      for (const k of bases.keys()) off.set(k, 0);
      for (const sc of allScrews) sc.obj.visible = false;
      let start = 0;
      let cap = 0;
      for (const st of steps) {
        const raw = t === null ? -1 : (t - start) / st.ms;
        const p = Math.max(0, Math.min(1, raw));
        if (t !== null && t >= start) cap = st.cap;
        for (const mv of st.moves ?? []) off.set(mv.obj, (off.get(mv.obj) ?? 0) + mv.delta * easeInOut(p));
        for (const sc of st.screws ?? []) {
          const shown = raw >= sc.start;
          sc.obj.visible = shown;
          if (!shown) continue;
          const u = Math.min(1, (raw - sc.start) / (sc.end - sc.start));
          const e = easeInOut(u);
          sc.drive.position.y = sc.lift * (1 - e);
          sc.drive.rotation.y = -e * SCREW_TURNS * Math.PI * 2;
          sc.drive.scale.setScalar(Math.min(1, 0.4 + u * 4));
        }
        start += st.ms;
      }
      for (const [obj, base] of bases) obj.position.x = base + (off.get(obj) ?? 0);
      showCap(t === null ? 0 : t >= playMs ? doneCap : cap);
    };
    const stopPlay = () => {
      playing = false;
      playT = 0;
      pose(null);
      setPlay("idle");
    };
    const togglePlay = () => {
      if (!steps.length) return;
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

    let cur = { d: 12, t: 1 as DwIns, kind: "de90" as Kind, c: "slip" as DwElbowConn, b: defaultB(12), cc: teeRun(12), xs: [] as readonly number[] };
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const { d, t, kind: k, c, b, cc, xs: x } = cur;
      // The connection goes on end 0 at its own size: the main A (elbows, tees, laterals) or, on a tap, the tap B (P is
      // the pipe it sits on, not what joins it).
      const dc = ELBOW[k].build === "tap" ? crossDims(k as CrossKind, d, x, t).top : d;
      const OD = dc + 2 * t;
      const ri = dc / 2;
      const ro = ri + t;
      const w = drawWall(OD);
      const segs = segsFor(OD);
      spangleE.repeat.set(Math.max(2, Math.round((Math.PI * (d + 2 * t)) / 10)), TEX_LENGTH / 10);
      const el = buildDwElbow(d, t, k, c, {
        outer: { metal: metalE, inside: insideE, seam: seamE },
        liner: linerE,
        collar: { metal: collarE, inside: insideE, seam: seamE },
        insul,
        insulCut,
        flange: couplingMat,
        vane: vaneMat,
        vaneEdge,
        plate: plateMat,
        ghost,
        ghostLiner,
      }, b, cc, x);
      const ductMats: DwMats = { outer, seam, edge, insul, insulCut, liner: linerSolid, linerSeam };
      steps = [];
      bases = new Map();
      allScrews = [];
      const pause: Step = { ms: STEP_PAUSE_MS, cap: -1 };
      const move = (obj: THREE.Object3D, delta: number) => {
        if (!bases.has(obj)) bases.set(obj, obj.position.x);
        return { obj, delta };
      };
      // The connection goes on the bottom end (end 0): the duct hangs straight down under the elbow, as on the single wall
      // elbow (the bullhead tee's inlet A, as on the single wall tee).
      const f = el.ends[0];
      if (c === "slip") {
        // Duct piece D (its liner end at D's x = 0): 12" liner; its outer shell + insulation (dO) start pulled back.
        // Assembled: the liner end against the inner collar's bead, the outer shell's end against the outer collar's bead.
        const stopI = CRIMP_X - 0.03;
        const stopO = -STICK_OUT + CRIMP_X - 0.03;
        const lead = stopI - stopO; // the duct liner sticks out this far past its outer shell when assembled
        const back = 4; // outer shell pulled back this far (the inner screws show)
        const gap = dc <= 8 ? 1.5 : dc <= 16 ? 2 : 2.5;
        const D = new THREE.Group();
        D.position.x = gap;
        f.add(D);
        D.add(buildSection(dc, t, ductMats, { liner: [0, JOIN_LENGTH], win: [] }));
        const dO = buildSection(dc, t, ductMats, { outer: [-lead, JOIN_LENGTH], ins: [0.05, JOIN_LENGTH], win: [] });
        dO.position.x = back;
        D.add(dO);
        const sx = (CRIMP_X + CRIMP_TAPER) / 2 - 0.15; // over the crimp, as the single wall slip joint
        const innerS = crimpScrews(dc, sx, screwMat);
        const outerS = crimpScrews(OD, -STICK_OUT + sx, screwMat);
        f.add(innerS.group, outerS.group);
        allScrews = [...innerS.items, ...outerS.items];
        steps = [
          { ms: 2000, cap: 1, moves: [move(D, stopI - gap)] },
          { ...pause, cap: 2 },
          { ms: 2200, cap: 2, screws: innerS.items },
          { ...pause, cap: 3 },
          { ms: 1800, cap: 3, moves: [move(dO, -back)] },
          { ...pause, cap: 4 },
          { ms: 2200, cap: 4, screws: outerS.items },
        ];
      } else if (c === "flange") {
        // As the double wall pipe's flange: the duct piece B capped by its flange ring, gasket between, screws.
        const rf = ro + (OD <= 12 ? 1.25 : 1.5);
        const ft = FLANGE_T;
        const gt = GASKET_T;
        const S = FLANGE_APART;
        const r0 = ri - w * 0.5;
        const B = new THREE.Group();
        B.position.x = S;
        f.add(B);
        const b0 = gt + ft;
        B.add(buildSection(dc, t, ductMats, { liner: [b0, b0 + JOIN_LENGTH], outer: [b0, b0 + JOIN_LENGTH], ins: [b0, b0 + JOIN_LENGTH], win: [] }));
        B.add(flatRing(r0, rf, gt, b0, segs, couplingMat, true));
        const gasket = flatRing(r0 + 0.02, rf - 0.03, 0, gt, segs, gasketMat, false);
        gasket.position.x = S / 2;
        f.add(gasket);
        const fS = buildFlangeScrews(OD, (ro + rf) / 2, b0, screwMat);
        f.add(fS.group);
        allScrews = fS.items;
        steps = [
          { ms: 1900, cap: 1, moves: [move(B, -S), move(gasket, -S / 2)] },
          { ...pause, cap: 2 },
          { ms: 2400, cap: 2, screws: fS.items },
        ];
      }
      doneCap = c === "none" ? 0 : STEPS[c].length - 1;
      steps = steps.map((st, i) => (st.cap === -1 ? { ...st, cap: steps[i + 1]?.cap ?? 0 } : st));
      playMs = steps.reduce((sum, st) => sum + st.ms, 0);
      stopPlay();
      // As drawn on the sheet: the bottom end on the left pointing down, the turn going up and to the right (the tee: B
      // left, C right, inlet A at the bottom).
      const elbow = el.group;
      elbow.rotation.y = ELBOW[k].build === "tee" || ELBOW[k].build === "cross" || ELBOW[k].build === "cone" || ELBOW[k].build === "lat" || ELBOW[k].build === "tap" ? 0 : Math.PI;
      elbow.updateMatrixWorld(true);
      elbow.position.sub(new THREE.Box3().setFromObject(elbow).getCenter(new THREE.Vector3()));
      model = new THREE.Group();
      model.add(elbow);
      scene.add(model);
      renderer.domElement.setAttribute(
        "aria-label",
        `3D double wall ${ELBOW[k].name.toLowerCase()}, solid liner, ${d} inch inside, ${t} inch insulation, ${d + 2 * t} inch outside, ${c === "none" ? "no connection" : c === "slip" ? "slip joint" : "flanged"}. Drag to turn, pinch to zoom.`,
      );
      frame(OD);
    };

    const resize = () => {
      W = el.clientWidth || 1;
      H = el.clientHeight || 1;
      renderer.setSize(W, H, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      project();
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      frame(cur.d + 2 * cur.t);
    });
    ro.observe(el);

    api.current = {
      set: (d, t, k, c, b, cc, x) => {
        const bld = ELBOW[k].build;
        const same = bld === "cross" || bld === "cone" || bld === "lat" || bld === "tap" ? x.join() === cur.xs.join() : (b === cur.b && cc === cur.cc) || (bld !== "heel" && bld !== "tee");
        if (model && d === cur.d && t === cur.t && k === cur.kind && c === cur.c && same) return;
        cur = { d, t, kind: k, c, b, cc, xs: [...x] };
        build();
      },
      setTopInset: (px) => {
        if (Math.abs(px - inset) < 1) return;
        inset = px;
        frame(cur.d + 2 * cur.t);
      },
      reset: () => {
        stopPlay();
        frame(cur.d + 2 * cur.t);
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
      allMats.forEach((m) => m.dispose());
      [spangleE, spangle, fiber, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    api.current?.set(diameter, ins, kind, connection, bDia, cDia, xs);
  }, [diameter, ins, kind, connection, bDia, cDia, xs]);

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

  const info =
    connection === "none"
      ? { title: spec.name, text: noneText() }
      : tee(STEPS[connection][step]);
  // The bullhead tee's / tee's / cross's captions: the same steps, "tee" or "cross" for "elbow" (a step can be missing for a
  // moment as the connection changes).
  function tee(st: { title: string; text: string } | undefined) {
    const noun = spec.build === "tap" ? "tap" : spec.build === "lat" ? "lateral" : spec.angle === 180 ? "cross" : "tee";
    return (bull || cross) && st ? { ...st, text: st.text.replace(/elbow/g, noun) } : st;
  }
  function noneText() {
    const ends = "2″ outer collars, the inner collar 2″ past each.";
    const r = `R = 1.5 × A* = ${R_FACTOR * diameter}″`;
    if (spec.build === "cross") {
      // The reducing types always reduce (B < A), so R > 0 there; the others go straight through.
      const k = kind as DwTeeType;
      const red = `A ${diameter}″ in on the left, reducer to B ${cd.out}″ on the right (R ${cd.R}″, reducer sheet)`;
      const main = k === "dt90" ? `Main A ${diameter}″ straight through, tap B ${cd.top}″ on top` : k === "drt90" ? `${red}, tap C ${cd.top}″ on top` : k === "dc180" ? `Main A ${diameter}″ straight through, tap B ${cd.top}″ on top, tap C ${cd.bottom}″ below` : `${red}, tap D ${cd.top}″ on top, tap C ${cd.bottom}″ below`;
      const l = `L = ${CROSS[k].lRule} = ${cd.Ls}″${k === "drt90" ? " (sheet prints B + 3″)" : ""}${cd.L > cd.Ls ? `, made ${cd.L}″* so the insulated tap fits` : ""}`;
      return `Solid liner. ${main}. ${l}; taps 4″ out*. ${ends}`;
    }
    if (spec.build === "tap") {
      const body = spec.cone ? `2″ collar, then a 3″ cone flaring to B + 2″* along the pipe` : `Straight collar`;
      const seat = spec.saddle ? `on a saddle plate 1″ past the tap` : `cut to the pipe's curve, saddle not included`;
      return `Solid liner. ${body}, B ${cd.top}″ on pipe P ${diameter}″, 5″ tall ${seat}. Pipe shown for reference. ${ends}`;
    }
    if (spec.build === "lat") {
      // Laterals: L from the top branch; DL45 reads the sheet's C as B (single wall L45).
      const k = kind as DwLatType;
      const red = `A ${diameter}″ in on the left, reducer to B ${cd.out}″ on the right (R ${cd.R}″, reducer sheet)`;
      const main = k === "dl45" ? `Main A ${diameter}″ straight through, 45° branch B ${cd.top}″ on top` : k === "drl45" ? `${red}, 45° branch C ${cd.top}″ on top` : k === "dlc45" ? `Main A ${diameter}″ straight through, 45° branches B ${cd.top}″ on top and C ${cd.bottom}″ below` : `${red}, 45° branches C ${cd.top}″ on top and D ${cd.bottom}″ below`;
      const l = `L = ${CROSS[k].lRule} = ${cd.Lx.toFixed(2)}″ → ${cd.Ls}″${k === "dl45" ? " (sheet prints C × 1.414 + 3″)" : ""}${cd.L > cd.Ls ? `, made ${cd.L}″* so the insulated branch fits` : ""}`;
      return `Solid liner. ${main}. ${l}. Each branch 2″ straight past the main on its short side, then the collars: ${ends}`;
    }
    if (spec.build === "cone") {
      // As the tees & crosses, with cone taps; this sheet puts C on top and D below on the DRCC180.
      const k = kind as DwConeType;
      const red = `A ${diameter}″ in on the left, reducer to B ${cd.out}″ on the right (R ${cd.R}″, reducer sheet)`;
      const main = k === "dct90" ? `Main A ${diameter}″ straight through, cone tap B ${cd.top}″ on top` : k === "drct90" ? `${red}, cone tap C ${cd.top}″ on top` : k === "dcc180" ? `Main A ${diameter}″ straight through, cone tap B ${cd.top}″ on top, cone tap C ${cd.bottom}″ below` : `${red}, cone tap C ${cd.top}″ on top, cone tap D ${cd.bottom}″ below`;
      const l = `L = ${CROSS[k].lRule} = ${cd.Ls}″${cd.L > cd.Ls ? `, made ${cd.L}″* so the insulated cone fits` : ""}`;
      return `Solid liner. ${main}. ${l}. Each cone 5″ tall, flaring to tap + 2″* on the main, then the collars: ${ends}`;
    }
    if (spec.build === "tee") {
      // Each run end: a reducer (R per the reducer sheet) when the outlet is smaller than A, else straight (R = 0).
      const outlet = (n: string, d: number, side: string) => (d < diameter ? `reducer to ${n} ${d}″ (${side})` : `straight to ${n} ${d}″ (${side}, no reducer)`);
      const outs = `${outlet("B", bDia, "left")} and ${outlet("C", cDia, "right")}${bDia < diameter || cDia < diameter ? ", R per the reducer sheet" : ""}`;
      const body = `Inlet A ${diameter}″ into the side of the body, L = A + 3″ = ${teeLs}″${teeL > teeLs ? `, made ${teeL}″* so the insulated inlet fits` : ""}; ${outs}. ${ends}`;
      if (!spec.vanes) return `90° bullhead tee, solid liner, no vanes. ${body}`;
      return vanes
        ? `90° bullhead tee, solid liner, ${vanes.n} splitter vanes each side (${vanes.range}*): look in an open end. ${body}`
        : `90° bullhead tee, solid liner. No vanes under ${VANES_FROM}″ (the sheet's table starts at ${VANES_FROM}″*). ${body}`;
    }
    if (spec.build === "miter") {
      const legs = `Each leg runs 4″ past the inside corner; ${ends}`;
      if (!spec.vanes) return `90° 2-piece mitered elbow, solid liner, no vanes. ${legs}`;
      return vanes
        ? `90° 2-piece mitered elbow, solid liner, ${vanes.n} turning vanes (${vanes.range}): look in the open end. ${legs}`
        : `90° 2-piece mitered elbow, solid liner. No vanes under ${VANES_FROM}″ (the sheet's table starts at ${VANES_FROM}″*). ${legs}`;
    }
    if (spec.build === "heel") return `${spec.short}, in line with the lower leg, its outer collar 5″ above the elbow; B ${bDia}″*. Solid liner. ${r}; ${ends}`;
    return `${spec.short} ${family === "miter" ? "" : "gored "}elbow, solid liner. ${r}; ${ends}`;
  }
  const radio = "btn-raised btn-raised-sm h-10 rounded-[0.65rem] font-display text-lg leading-none short:h-8";
  const label = "text-[11px] font-medium tracking-wide text-muted uppercase";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]" role="dialog" aria-modal="true" aria-label={`3D model: double wall round ${family === "miter" ? "mitered elbows" : bull ? "bullhead tees" : conical ? "conical tees and crosses" : lateral ? "laterals" : taps ? "straight and conical taps" : cross ? "tees and crosses" : "gored elbows"}`}>
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <ModelSubtitle family="Double Wall Round" name={spec.name} />
        </div>
        <HomeButton variant="round" />
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/15 active:bg-white/25" aria-label="Close 3D model">
          <X className="size-6" />
        </button>
      </header>
      <div ref={host} className="relative min-h-0 flex-1">
        {failed && (
          <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted">3D isn&apos;t available on this device (WebGL is turned off or not supported).</p>
        )}
        {!failed && (
          <div
            ref={caption}
            className="pointer-events-none absolute inset-x-3 top-3 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:inset-x-auto short:left-3 short:py-1"
            aria-live="polite"
            data-testid="connection-caption"
            data-step={connection === "none" ? 0 : step}
          >
            <p className="font-display text-lg leading-tight text-accent">{info?.title}</p>
            <p className="text-xs leading-snug text-ink short:hidden">{info?.text}</p>
          </div>
        )}
        {hint && !failed && <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-steel">Drag to turn · pinch to zoom</p>}
      </div>
      <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2 short:pt-1">
        <div className={`grid ${bull ? "grid-cols-2" : "grid-cols-4"} gap-1.5`} role="radiogroup" aria-label={bull ? "Tee" : cross ? "Type" : "Elbow"}>
          <span className={`${label} ${bull ? "col-span-2" : "col-span-4"} -mb-1`}>
            {bull ? "Tee" : cross ? "Type" : "Elbow"} · {spec.short}
          </span>
          {types.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} aria-label={`${ELBOW[k].code ?? k.toUpperCase()}, ${ELBOW[k].short}`} onClick={() => setKind(k)} className={`${radio} px-0`}>
              {ELBOW[k].sub ? (
                // Taps: the printed code (DCT90 twice) over saddle / no saddle.
                <span className="flex flex-col items-center leading-none">
                  <span className="text-base leading-none">{ELBOW[k].code}</span>
                  <span className="font-sans text-[9px] leading-none tracking-wide uppercase opacity-80">{ELBOW[k].sub}</span>
                </span>
              ) : (
                k.toUpperCase()
              )}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Connection">
          <span className={`${label} col-span-3 -mb-1`}>Connection</span>
          {(["none", "slip", "flange"] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={connection === c} onClick={() => setConnection(c)} className={`${radio} px-0`}>
              {CONN_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-2">
          <div className="col-span-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Insulation thickness">
            <span className={`${label} col-span-3 -mb-1`}>Insulation</span>
            {DW_INS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={ins === t} aria-label={`${t} inch insulation`} onClick={() => setIns(t)} className={`${radio} px-0`}>
                {t}&Prime;
              </button>
            ))}
          </div>
          {connection !== "none" && !failed ? (
            <div className="col-span-3 flex flex-col">
              <span className={`${label} -mb-1`}>How it goes together</span>
              <button
                type="button"
                onClick={() => api.current?.play()}
                aria-label={play === "playing" ? "Pause" : play === "done" ? "Replay how it goes together" : "Play how it goes together"}
                className={`${radio} mt-2 flex items-center justify-center gap-1.5`}
              >
                {play === "playing" ? <Pause className="size-4" aria-hidden="true" /> : play === "done" ? <RotateCw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                {play === "playing" ? "Pause" : play === "done" ? "Replay" : play === "paused" ? "Resume" : "Play"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {bull && (
        // Bullhead tee sizes: inlet A (inside), outlets B (left) and C (right), each no bigger than A (single wall rule).
        <div className="grid grid-cols-3 gap-1.5 bg-surface/90 px-3 pt-2">
          {(
            [
              ["A · inlet ID", diameter, (d: number) => {
                setDiameter(d);
                setBDia((b) => Math.min(b, d));
                setCDia((c) => Math.min(c, d));
              }, STOCK_DIAMETERS, "Inner diameter", "″ ID"],
              ["B · left", bDia, setBDia, STOCK_DIAMETERS.filter((d) => d <= diameter), "Size B (left)", "″"],
              ["C · right", cDia, setCDia, STOCK_DIAMETERS.filter((d) => d <= diameter), "Size C (right)", "″"],
            ] as const
          ).map(([text, value, set, sizes, aria, unit]) => (
            <label key={text} className="flex min-w-0 flex-col">
              <span className={`${label} truncate`}>{text}</span>
              <select value={value} onChange={(e) => set(Number(e.target.value))} aria-label={aria} className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg">
                {sizes.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {cross && (
        // Tee / cross sizes: main A (inside), then B, C, D as on the sheet; taps up to A, the outlet B under A.
        <div className={`grid ${["", "", "grid-cols-2", "grid-cols-3", "grid-cols-4"][CROSS[ck].sizes.length + 1]} gap-1.5 bg-surface/90 px-3 pt-2`} data-testid="cross-sizes">
          <label className="flex min-w-0 flex-col">
            <span className={`${label} truncate`}>{taps ? "P · pipe" : CROSS[ck].reducing ? "A · inlet" : "A · main"}</span>
            <select value={diameter} onChange={(e) => setCrossA(Number(e.target.value))} aria-label="Inner diameter" className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg">
              {STOCK_DIAMETERS.filter((d) => (!CROSS[ck].reducing || d > STOCK_DIAMETERS[0]) && d >= STOCK_DIAMETERS[0] + (spec.gap ?? 0)).map((d) => (
                <option key={d} value={d}>
                  {d}&Prime; ID
                </option>
              ))}
            </select>
          </label>
          {CROSS[ck].sizes.map((s, i) => (
            <label key={`${ck}-${s.label}`} className="flex min-w-0 flex-col">
              <span className={`${label} truncate`}>{s.label}</span>
              <select
                value={xs[i]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCrossXs((all) => ({ ...all, [ck]: clampCross(ck, diameter, all[ck].map((x, j) => (j === i ? v : x))) }));
                }}
                aria-label={`Size ${s.label.replace(" · ", " (")})`}
                className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
              >
                {STOCK_DIAMETERS.filter((d) => (s.role === "out" ? d < diameter : d <= diameter - (spec.gap ?? 0)) && !(lateral && s.role === "bottom" && d > cd.top)).map((d) => (
                  <option key={d} value={d}>
                    {d}&Prime;
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 bg-surface/90 px-3 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {bull || cross ? null : (
        <label className="flex w-[5.5rem] shrink-0 flex-col">
          <span className={label}>Inside Ø</span>
          <select
            value={diameter}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDiameter(d);
              setBDia(defaultB(d));
            }} className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-2 font-display text-lg" aria-label="Inner diameter">
            {STOCK_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}&Prime; ID
              </option>
            ))}
          </select>
        </label>
        )}
        {kind === "d3p90h" && (
          // Collar B: the sheet gives no sizes; any stock size up to A* (default about 3/4 A, as drawn).
          <label className="flex w-[4.25rem] shrink-0 flex-col">
            <span className={label}>B Ø*</span>
            <select value={bDia} onChange={(e) => setBDia(Number(e.target.value))} className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-1.5 font-display text-lg" aria-label="Collar B diameter">
              {STOCK_DIAMETERS.filter((d) => d <= diameter).map((d) => (
                <option key={d} value={d}>
                  {d}&Prime; B
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="min-w-0 flex-1 text-[11px] leading-snug whitespace-nowrap text-ink" data-testid="dw-readout">
          {taps ? (
            <>
              <p className="truncate">
                <b className="font-semibold">
                  B {cd.top}&Prime; on P {diameter}&Prime; · outer {cd.top + 2 * ins}&Prime; · 5&Prime; tall
                </b>
              </p>
              <p className="truncate">
                {gauge} ga · {spec.cone ? <>cone, base B + 2&Prime;*</> : <>straight</>} · {spec.saddle ? <>saddle 1&Prime; lip</> : <>no saddle</>}
              </p>
              <p className="truncate text-muted">* assumed · B up to P{spec.gap ? <> − {spec.gap}&Prime;</> : null} · gauge by B, +2&Prime; W.G.*</p>
            </>
          ) : cross ? (
            <>
              <p className="truncate">
                <b className="font-semibold">
                  A {diameter}&Prime; ID · {od}&Prime; OD* · L {cd.L}&Prime;{cd.L > cd.Ls || kind === "dl45" ? "*" : ""}
                  {CROSS[ck].reducing ? <> · R {cd.R}&Prime;</> : null}
                </b>
              </p>
              <p className="truncate">
                {gauge} ga outer · {gauge} liner* · {lateral ? <>branches 45°, 2&Prime; straight</> : conical ? <>cones 5&Prime;, base +2&Prime;*</> : <>taps 4&Prime; out*</>}
              </p>
              <p className="truncate text-muted">
                * assumed{cd.L > cd.Ls ? <> · sheet L {cd.Ls}&Prime;</> : null}
                {lateral && kind === "dl45" && cd.L <= cd.Ls ? <> · L from B (sheet prints C)</> : null} · +2&Prime; W.G. gauges
              </p>
            </>
          ) : bull ? (
            <>
              <p className="truncate">
                <b className="font-semibold">
                  A {diameter}&Prime; ID · {od}&Prime; OD* · L {teeL}&Prime;{teeL > teeLs ? "*" : ""} · R {rB}&Prime; / {rC}&Prime;
                </b>
              </p>
              <p className="truncate">
                {gauge} ga outer · {gauge} liner*{spec.vanes ? (vanes ? ` · ${vanes.n} vanes each side*` : ` · vanes from ${VANES_FROM}″`) : ""}
              </p>
              <p className="truncate text-muted">* assumed{teeL > teeLs ? <> · sheet L {teeLs}&Prime;</> : null} · +2&Prime; W.G. gauges</p>
            </>
          ) : (
          <>
          <p className="truncate">
            <b className="font-semibold">
              {kind === "d3p90h" ? "" : <>{diameter}&Prime; ID · </>}
              {od}&Prime; OD*{spec.build === "miter" ? <> · 4&Prime; legs</> : <> · R {R_FACTOR * diameter}&Prime;*</>}
            </b>
          </p>
          <p className="truncate">
            {gauge} ga outer · {gauge} liner*{spec.vanes ? (vanes ? ` · ${vanes.n} vanes` : ` · vanes from ${VANES_FROM}″`) : ""}
          </p>
          <p className="truncate text-muted">* assumed · +2&Prime; W.G. gauges</p>
          </>
          )}
        </div>
        <button type="button" onClick={() => api.current?.reset()} className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]" aria-label="Reset view">
          <RotateCcw className="size-5" />
        </button>
      </div>
    </div>
  );
}
