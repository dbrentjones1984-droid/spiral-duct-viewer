import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
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
import { SWF_TEE_3D_HASH, teeHash, TEE_TYPES, type TeeType } from "@/lib/route";
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
 * "R = refer to reducer drawing", which we don't have yet, so reducerLength() is an assumption. With Vanes on (BTV90)
 * it adds curved splitter vanes in a mirrored pair of sets, turning the branch flow out to both run ends (count by A,
 * same table as the MEV90 - an assumption), walls see-through. Connections go on the branch end.
 * And the tees & crosses (kind "tee", catalog sheet "Tees and Crosses"), one model with a type picker: a straight main
 * of diameter A, L = largest tap + 3" long between the 2" beaded ends, with round taps centred on it that meet it in a
 * saddle (the two cylinders' intersection) and end TEE_BRANCH out from the main's wall in a 2" beaded collar:
 *   T90   tee 90°: A both ends, tap B on top.
 *   RT90  reducing tee 90°: A in on the left, reducer R down to outlet B on the right, tap C on top.
 *   C180  cross 180°: A both ends, tap B on top and tap C on the bottom.
 *   RC180 reducing cross 180°: A in, reducer R to B, taps C on top and D on the bottom.
 * R uses the bullhead tee's assumed reducerLength(). Connections go on the A inlet end (left). No vanes.
 */

const TEX_LENGTH = 48; // spangle size matches the Round pipe's 4 ft section
const COLLAR = 2; // straight ends, as dimensioned on the sheet
const DEG = Math.PI / 180;
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
/**
 * Reducer length R from the body (A) down to an outlet (B or C). ASSUMED until Brent sends the reducer sheet: none when
 * the outlet is the full size, else 1.25 x the size drop (the sheet's drawing: about 5" for 12" to 8"), at least 2" and
 * at most 12", in 1/2" steps.
 */
export function reducerLength(a: number, b: number) {
  if (b >= a) return 0;
  return Math.min(12, Math.max(2, Math.ceil(1.25 * (a - b) * 2) / 2));
}

/** The elbows this viewer shows. */
export type ElbowKind = "e90" | "ds90" | "me90" | "bt90" | "tee";
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

/** Play timing, same as the duct: slide together, short pause, drive the screws. */
const SLIDE_MS = 2300;
const SCREW_PAUSE_MS = 200;
const SCREW_MS = 2300;
const SCREW_TURNS = 4;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";

export default function GoredElbow3D({ onClose, kind = "e90", teeType: teeType0 = "t90" }: { onClose: () => void; kind?: ElbowKind; teeType?: TeeType }) {
  const spec = ELBOWS[kind];
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setDiameter: (d: number) => void;
    setConnection: (c: Connection) => void;
    setVanes: (n: number) => void;
    setRun: (b: number, c: number) => void;
    setCross: (type: TeeType, sizes: readonly number[]) => void;
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
  const [teeType, setTeeType] = useState<TeeType>(teeType0);
  const [teeSizes, setTeeSizes] = useState<readonly number[]>(TEES[teeType0].defaults);
  const [play, setPlay] = useState<PlayState>("idle");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const cross = kind === "tee";
  const gauge = stockGauge(cross ? teeSizes[0] : diameter);

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
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, map: spangle, metalness: 0.5, roughness: 0.42, envMapIntensity: 1, side: THREE.DoubleSide });
    const vaneEdge = new THREE.MeshStandardMaterial({ color: 0x5f6b77, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8 });

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
      const solid: Mats = { metal, inside, seam };
      const { group: elbow, ends } =
        kind === "tee"
          ? buildCross(currentTee, currentTeeSizes, solid, style)
          : kind === "me90"
          ? buildMitered(d, v > 0 ? ghostMats : solid, style, v, vaneMat, vaneEdge)
          : kind === "bt90"
            ? buildTee(d, Math.min(currentB, d), Math.min(currentRunC, d), v > 0 ? ghostMats : solid, style, v, vaneMat, vaneEdge)
            : buildElbow(d, solid, style, kind);
      // The bottom end reads best on a phone: the duct hangs straight down under the elbow, in the tall screen.
      const joint = c === "coupling" ? slipJoint(d, ends[0], pipeMats, screwMat) : c === "flange" ? flangeJoint(d, ends[0], pipeMats, metal, sheet, gasketMat, screwMat) : null;
      moving = joint ? joint.moving.map((m) => ({ ...m, base: m.obj.position.x })) : [];
      screws = joint ? joint.screws.items : [];
      stopPlay();
      // Elbows: bottom end on the left, other end out to the right, as drawn on the sheet. Tee: B left, C right, as drawn.
      elbow.rotation.y = kind === "bt90" || kind === "tee" ? 0 : Math.PI;
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
    let currentTee: TeeType = teeType0;
    let currentTeeSizes: readonly number[] = TEES[teeType0].defaults;
    let currentD = kind === "tee" ? currentTeeSizes[0] : spec.defaultD;
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
        currentD = sizes[0];
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
      [metal, seam, inside, sheet, screwMat, gasketMat, ...Object.values(ghostMats), vaneMat, vaneEdge].forEach((m) => m.dispose());
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
  const teeSpec = TEES[teeType];
  const dims = teeDims(teeType, teeSizes);
  const name = cross ? `${teeSpec.name} (${teeSpec.code})` : vanes ? (tee ? "Bullhead Tee 90° (BTV90)" : "Mitered 90° Elbow (MEV90)") : spec.name;
  const info =
    cross
      ? connection !== "none"
        ? CROSS_CONNECTION_INFO[connection]
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
  const pickType = (t: TeeType) => {
    if (t === teeType) return;
    setTeeType(t);
    setTeeSizes(TEES[t].defaults);
    if (location.hash.startsWith(SWF_TEE_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + teeHash(t));
  };
  const setTeeSize = (i: number, d: number) =>
    setTeeSizes((s) => (i === 0 ? s.map((x, k) => (k === 0 ? d : Math.min(x, d))) : s.map((x, k) => (k === i ? d : x))));
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
          <div className="grid grid-cols-4 gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label="Tee or cross type">
            {TEE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={teeType === t}
                aria-label={`${TEES[t].name} (${TEES[t].code})`}
                onClick={() => pickType(t)}
                className="btn-raised btn-raised-sm h-9 min-w-0 rounded-[0.65rem] px-1 font-display text-lg leading-none short:h-8"
              >
                {TEES[t].code}
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
                  {(i === 0 ? spec.sizes : spec.sizes.filter((d) => d <= teeSizes[0])).map((d) => (
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
              <p className="truncate">
                <b className="font-semibold">{gauge.fitting} ga</b> fitting · L = <b className="font-semibold">{inches(dims.L)}&Prime;</b>
                {dims.reducing && (
                  <>
                    {" "}
                    · R = <b className="font-semibold">{inches(dims.R)}&Prime;</b>
                  </>
                )}
              </p>
              <p className="truncate text-muted">
                {spec.note} · L = {teeSpec.lRule}
                {dims.reducing ? " · R assumed" : ""}
              </p>
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
                  `${spec.note} · R assumed`
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
