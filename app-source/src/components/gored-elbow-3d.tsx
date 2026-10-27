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

/** The elbows this viewer shows. */
export type ElbowKind = "e90" | "ds90" | "me90";
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
};

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
  const vs = 10;
  for (let k = 0; k < n; k++) {
    const t = -r + step * (k + 1) - a * 0.1;
    const cx = t - a * H;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= us; i++) {
      const th = (i / us) * (Math.PI / 2);
      const x = cx + a * Math.cos(th);
      const y = cx + a * Math.sin(th);
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

/** Play timing, same as the duct: slide together, short pause, drive the screws. */
const SLIDE_MS = 2300;
const SCREW_PAUSE_MS = 200;
const SCREW_MS = 2300;
const SCREW_TURNS = 4;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";

export default function GoredElbow3D({ onClose, kind = "e90" }: { onClose: () => void; kind?: ElbowKind }) {
  const spec = ELBOWS[kind];
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setDiameter: (d: number) => void;
    setConnection: (c: Connection) => void;
    setVanes: (n: number) => void;
    setTopInset: (px: number) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [diameter, setDiameter] = useState(spec.defaultD);
  const [connection, setConnection] = useState<Connection>("none");
  const [vanesOn, setVanesOn] = useState(false);
  const vanes = kind === "me90" && vanesOn ? vaneSpec(diameter) : null; // shown only from 8" (sheet's table)
  const [play, setPlay] = useState<PlayState>("idle");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const gauge = stockGauge(diameter);

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
      view = v > 0 ? new THREE.Vector3(-0.85, 0.42, 1) : new THREE.Vector3(0.3, 0.32, 1);
      const { group: elbow, ends } =
        kind === "me90"
          ? buildMitered(d, v > 0 ? ghostMats : { metal, inside, seam }, style, v, vaneMat, vaneEdge)
          : buildElbow(d, { metal, inside, seam }, style, kind);
      // The bottom end reads best on a phone: the duct hangs straight down under the elbow, in the tall screen.
      const joint = c === "coupling" ? slipJoint(d, ends[0], pipeMats, screwMat) : c === "flange" ? flangeJoint(d, ends[0], pipeMats, metal, sheet, gasketMat, screwMat) : null;
      moving = joint ? joint.moving.map((m) => ({ ...m, base: m.obj.position.x })) : [];
      screws = joint ? joint.screws.items : [];
      stopPlay();
      elbow.rotation.y = Math.PI; // bottom end on the left, other end out to the right, as drawn on the sheet
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
    let currentD = spec.defaultD;
    let currentC: Connection = "none";
    let currentV = 0;
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

  useEffect(() => {
    api.current?.setDiameter(diameter);
  }, [diameter]);
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
  const name = vanes ? "Mitered 90° Elbow (MEV90)" : spec.name;
  const info =
    connection !== "none"
      ? ELBOW_CONNECTION_INFO[connection]
      : vanes
        ? { title: "Mitered 90° Elbow w/ Vanes (MEV90)", text: `${vanes.n} curved turning vanes along the miter, across the full duct (${vanes.n} for ${vanes.range}). Walls shown see-through.` }
        : spec.none;

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
      {kind === "me90" && (
        // Turning vanes (MEV90), separate from the connection. Made from 8" up (sheet's table).
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
    </div>
  );
}
