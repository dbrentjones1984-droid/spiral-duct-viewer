import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONNECTIONS, flangeScrewCount, JOIN_LENGTH, samples, screwCount, screwMesh, screwScale, type BuiltConnection, type Connection } from "@/components/duct-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";
import { OVAL_BENDS, OVAL_ELBOW_TYPES, ovalElbowHash, SWFO_ELBOW_3D_HASH, type OvalBend, type OvalElbowType } from "@/lib/route";
import { OVAL_MAJORS, ovalMinorsFor, ovalSize } from "@/lib/oval-sizes";

/*
 * Single Wall Oval > Elbows (oval fittings sheet 1): 90HB5, 60HB3, 45HB3 and 30HB2 gored elbows in flat oval A x α
 * (the sheet writes the minor axis as α), one model with a type picker, a Hard / Easy bend toggle and the A and α sizes
 * from the oval gauge chart. Same viewer as the round gored elbows (gored-elbow-3d.tsx): orbit, materials, the
 * Coupling / Flange buttons with Play on the bottom end, joined to a 12" piece of the same oval duct.
 *
 * Flat oval = rectangle with semicircle ends: end radius α/2, flats A - α. Built at any A x α (the oval duct viewer's
 * oval-connections.ts is fixed at 25 x 16, so this file has its own sized copy of those helpers).
 *
 * Bends (the sheet's note): "R = 1.5 x A, Hard Bend; R = 1.5 x α, Easy Bend". Read as: hard bend = the elbow turns in
 * the plane of the major axis A (A lies in the bend plane, the wide way round), centerline radius 1.5 A; easy bend =
 * it turns in the plane of the minor axis α (the flat sides face the bend's centre), R = 1.5 α.
 *
 * Gores, like the round gored elbows: an N-piece elbow of angle θ has two end gores of θ / (2(N - 1)) and N - 2
 * middle gores of θ / (N - 1) (90HB5: 11-1/4°, 22-1/2° x 3, 11-1/4°; 30HB2: two 15° gores), each a straight oval
 * piece mitred on the joint planes, with a raised seam at each joint, and a 2" straight collar at each end.
 * Units are inches.
 */

const TEX_LENGTH = 48;
const COLLAR = 2;
const DEG = Math.PI / 180;
const SLIDE_MS = 2300;
const SCREW_PAUSE_MS = 200;
const SCREW_MS = 2300;
const SCREW_TURNS = 4;
const STRIP_PITCH = 5.6;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";
type EndStyle = "bead" | "crimp" | "plain";
type Mats = { metal: THREE.Material; inside: THREE.Material; seam: THREE.Material };

export const OVAL_ELBOWS: Record<OvalElbowType, { code: string; angle: number; pieces: number; name: string; short: string }> = {
  "90hb5": { code: "90HB5", angle: 90, pieces: 5, name: "90° 5-Piece Elbow", short: "90° · 5 pc" },
  "60hb3": { code: "60HB3", angle: 60, pieces: 3, name: "60° 3-Piece Elbow", short: "60° · 3 pc" },
  "45hb3": { code: "45HB3", angle: 45, pieces: 3, name: "45° 3-Piece Elbow", short: "45° · 3 pc" },
  "30hb2": { code: "30HB2", angle: 30, pieces: 2, name: "30° 2-Piece Elbow", short: "30° · 2 pc" },
};

/** Gore joint angles along the turn: [0, end gore, + middle gores ..., angle] (degrees). */
export function goreSeams(angle: number, pieces: number) {
  const mid = angle / (pieces - 1);
  const seams = [0, mid / 2];
  for (let k = 0; k < pieces - 2; k++) seams.push(seams[seams.length - 1] + mid);
  seams.push(angle);
  return seams;
}

const DEFAULT_A = 25; // same size as the oval duct model
const DEFAULT_MINOR = 16;

/** Inches with halves and quarters as fractions (R = 1.5 x 25 = 37-1/2). */
const inches = (x: number) => {
  const w = Math.floor(x + 1e-9);
  const f = Math.round((x - w) * 4);
  return f === 0 ? `${w}` : f === 2 ? `${w}½` : f === 1 ? `${w}¼` : `${w}¾`;
};
const degs = (x: number) => {
  const w = Math.floor(x + 1e-9);
  const f = Math.round((x - w) * 4);
  return (f === 0 ? `${w}` : f === 2 ? `${w}½` : f === 1 ? `${w}¼` : `${w}¾`) + "°";
};

/** Flat-oval helpers at one size (same maths as oval-connections.ts, which is fixed at 25 x 16). Axis X, minor Y, major Z. */
function ovalKit(A: number, minor: number) {
  const F = A - minor;
  const R0 = minor / 2;
  const eqD = (2 * F + Math.PI * minor) / Math.PI;
  /** Point at fraction u around (by arc length on the oval of radius rhoParam), from the middle of the top flat. [y, z, ny, nz] */
  const point = (u: number, rho: number, rhoParam = rho): [number, number, number, number] => {
    const arc = Math.PI * rhoParam;
    let s = (((u % 1) + 1) % 1) * (2 * F + 2 * arc);
    const end = (a: number, cz: number): [number, number, number, number] => {
      const ny = Math.cos(a);
      const nz = Math.sin(a);
      return [ny * rho, cz + nz * rho, ny, nz];
    };
    if (s < F / 2) return [rho, s, 1, 0];
    s -= F / 2;
    if (s < arc) return end((s / arc) * Math.PI, F / 2);
    s -= arc;
    if (s < F) return [-rho, F / 2 - s, -1, 0];
    s -= F;
    if (s < arc) return end(Math.PI + (s / arc) * Math.PI, -F / 2);
    s -= arc;
    return [rho, -F / 2 + s, 1, 0];
  };
  const perimeter = (rho: number) => 2 * F + 2 * Math.PI * rho;
  const outline = (rho: number, n: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const [y, z] = point(i / n, rho);
      pts.push(new THREE.Vector2(z, y));
    }
    return pts;
  };
  /** Oval tube along X: rings at xs, end radius rho(x, u). */
  const shell = (xs: number[], S: number, rho: (x: number, u: number) => number, uvScale: number, rhoParam = R0) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    xs.forEach((x) => {
      for (let j = 0; j <= S; j++) {
        const u = j / S;
        const [y, z] = point(u, rho(x, u % 1), rhoParam);
        pos.push(x, y, z);
        uv.push(u, x * uvScale);
      }
    });
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < S; j++) {
        const a = i * (S + 1) + j;
        const b = a + S + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.getAttribute("normal") as THREE.BufferAttribute;
    for (let i = 0; i < xs.length; i++) {
      const p = i * (S + 1);
      const q = p + S;
      const v = new THREE.Vector3(n.getX(p) + n.getX(q), n.getY(p) + n.getY(q), n.getZ(p) + n.getZ(q)).normalize();
      n.setXYZ(p, v.x, v.y, v.z);
      n.setXYZ(q, v.x, v.y, v.z);
    }
    return g;
  };
  /** Closed loop around the oval at one X. */
  class Loop extends THREE.Curve<THREE.Vector3> {
    constructor(
      private rho: number,
      private x: number,
    ) {
      super();
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const [y, z] = point(t, this.rho);
      return target.set(this.x, y, z);
    }
  }
  /** Flat oval ring (plate) of thickness t along X (0..t). */
  const ring = (ro: number, ri: number, t: number, segs: number, uvScale: number) => {
    const shape = new THREE.Shape(outline(ro, segs));
    shape.holes.push(new THREE.Path(outline(ri, segs).reverse()));
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
    g.rotateY(Math.PI / 2);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
    return g;
  };
  /** Flat end rim (cut edge) at x, facing X. */
  const rim = (ro: number, ri: number, x: number, segs: number) => {
    const shape = new THREE.Shape(outline(ro, segs));
    shape.holes.push(new THREE.Path(outline(ri, segs).reverse()));
    const g = new THREE.ShapeGeometry(shape, 1);
    g.rotateY(Math.PI / 2);
    g.translate(x, 0, 0);
    return g;
  };
  return { A, minor, F, R0, eqD, wall: Math.max(0.05, eqD * 0.006), point, perimeter, outline, shell, Loop, ring, rim };
}
type Kit = ReturnType<typeof ovalKit>;

/** Spiral lock seam on the 12" oval duct piece. */
class OvalHelix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private kit: Kit,
    private rho: number,
    private length: number,
    private phase = 0,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const x = -this.length / 2 + t * this.length;
    const [y, z] = this.kit.point(x / STRIP_PITCH + this.phase, this.rho, this.kit.R0);
    return target.set(x, y, z);
  }
}
const helix = (kit: Kit, rho: number, length: number, phase = 0) => new OvalHelix(kit, rho, length, phase);

/** Short piece of oval spiral duct, same as the oval duct model, centred on x = 0 along X. */
function buildOvalPipe(kit: Kit, { metal, inside, seam }: Mats, L = JOIN_LENGTH) {
  const group = new THREE.Group();
  const R = kit.R0;
  const P = kit.perimeter(R);
  const S = 256;
  const uv = 1 / TEX_LENGTH;
  group.add(new THREE.Mesh(kit.shell([-L / 2, L / 2], S, () => R, uv), metal));
  group.add(new THREE.Mesh(kit.shell([-L / 2, L / 2], S, () => R - kit.wall, uv), inside));
  const segs = Math.round((L / STRIP_PITCH) * 160);
  const rib = Math.min(0.2, 0.09 + kit.eqD * 0.004);
  const seamL = L - rib * 4;
  group.add(
    new THREE.Mesh(new THREE.TubeGeometry(helix(kit, R + rib * 0.15, seamL), segs, rib, 8, false), seam),
    new THREE.Mesh(new THREE.TubeGeometry(helix(kit, R + rib * 0.05, seamL, (rib * 2.1) / P), segs, rib * 0.75, 8, false), seam),
  );
  for (const x of [-L / 2, L / 2]) group.add(new THREE.Mesh(kit.rim(R + 0.005, R - kit.wall, x, S), metal));
  return group;
}

// ---- The elbow. Bend in the XY plane about the Z axis (B), centerline radius R, turning from angle 0 to θ. ----
const B = new THREE.Vector3(0, 0, 1);
const centerline = (a: number, R: number) => new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), 0);
const tangent = (a: number) => new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
const outward = (a: number) => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);

/**
 * Profile point in the bend's frame: q = offset toward the outside of the bend (in the bend plane), w = along B.
 * Hard bend: the major axis lies in the bend plane (q = z, w = -y); easy bend: the minor axis does (q = y, w = z).
 * (Both keep the same turning sense around the section, so the faces stay outward.)
 */
function profile(kit: Kit, hard: boolean, u: number, rho: number) {
  const [y, z, ny, nz] = kit.point(u, rho, kit.R0);
  return hard ? { q: z, w: -y, nq: nz, nw: -ny } : { q: y, w: z, nq: ny, nw: nz };
}

/** One gore: straight oval piece along the tangent at t, cut by the joint planes at angles a0 and a1. */
function gore(kit: Kit, hard: boolean, R: number, rho: number, t: number, a0: number, a1: number, vBase: number, S: number) {
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
    for (let j = 0; j <= S; j++) {
      const { q, w, nq, nw } = profile(kit, hard, j / S, rho);
      const sFrom = (R + q) * Math.tan(a0 - t);
      const sTo = (R + q) * Math.tan(a1 - t);
      const s = sFrom + ((sTo - sFrom) * i) / rows;
      n.copy(N).multiplyScalar(nq).addScaledVector(B, nw);
      p.copy(O).addScaledVector(T, s).addScaledVector(N, q).addScaledVector(B, w);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      uv.push(j / S, (vBase + s) / TEX_LENGTH);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j;
      const b = a + S + 1;
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

/** Closed loop around a gore joint (the stretched oval where the joint plane cuts the piece), for the raised seam. */
class JointLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private kit: Kit,
    private hard: boolean,
    private R: number,
    private rho: number,
    private t: number,
    private a: number,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const { q, w } = profile(this.kit, this.hard, u, this.rho);
    const s = (this.R + q) * Math.tan(this.a - this.t);
    return target.copy(centerline(this.t, this.R)).addScaledVector(tangent(this.t), s).addScaledVector(outward(this.t), q).addScaledVector(B, w);
  }
}

const BEAD_X = -1.55;
const CRIMP_X = -1.3;
const CRIMP_TAPER = 0.22;

/** Crimped end: same as the round elbows, stepped down to fit inside the oval duct and fluted to the cut edge. */
function crimpRho(kit: Kit) {
  const r = kit.R0;
  const rcr = r - kit.wall - 0.05;
  const flutes = Math.max(24, Math.round(kit.perimeter(rcr) / 0.42));
  const cd = 0.1 + kit.eqD * 0.003;
  return {
    flutes,
    rcr,
    rho: (x: number, u: number) => {
      if (x < CRIMP_X) return r;
      const e = Math.min(1, (x - CRIMP_X) / CRIMP_TAPER);
      const k = e * e * (3 - 2 * e);
      return r - (r - rcr) * k - cd * k * 0.5 * (1 - Math.cos(flutes * u * Math.PI * 2));
    },
  };
}

/** One end's 2" collar (in its end frame, x = -2..0), its bead and the cut rim. */
function buildCollar(kit: Kit, style: EndStyle, { metal, inside, seam }: Mats, bead: number, S: number) {
  const g = new THREE.Group();
  const r = kit.R0;
  const uv = 1 / TEX_LENGTH;
  if (style === "crimp") {
    const c = crimpRho(kit);
    const xs = samples(-COLLAR, 0, (x) => x > CRIMP_X - 0.05, 0.05, 0.3);
    const segs = c.flutes * 4;
    g.add(new THREE.Mesh(kit.shell(xs, segs, c.rho, uv), metal));
    g.add(new THREE.Mesh(kit.shell(xs, segs, (x, u) => c.rho(x, u) - kit.wall, uv), inside));
    g.add(new THREE.Mesh(kit.rim(c.rcr, c.rcr - kit.wall - 0.1 - kit.eqD * 0.003, 0, segs), metal));
  } else {
    g.add(new THREE.Mesh(kit.shell([-COLLAR, 0], S, () => r, uv), metal));
    g.add(new THREE.Mesh(kit.shell([-COLLAR, 0], S, () => r - kit.wall, uv), inside));
    g.add(new THREE.Mesh(kit.rim(r + 0.005, r - kit.wall, 0, S), metal));
  }
  if (style !== "plain") {
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(r + bead * 0.2, style === "crimp" ? BEAD_X : -COLLAR), S, bead, 8, true), seam));
  }
  return g;
}

/**
 * End frame: origin at the open end's centre, +X out of the elbow, local Z along the major axis (the oval helpers'
 * major axis), so collars and connections are built along +X the same as on the straight duct.
 */
function endFrame(end: 0 | 1, R: number, angle: number, hard: boolean) {
  const t = end === 0 ? 0 : angle;
  const out = tangent(t).multiplyScalar(end === 0 ? -1 : 1);
  const major = hard ? outward(t) : B.clone();
  const y = new THREE.Vector3().crossVectors(major, out);
  const g = new THREE.Group();
  g.position.copy(centerline(t, R)).addScaledVector(out, COLLAR);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(out, y, major));
  return g;
}

function buildOvalElbow(kit: Kit, type: OvalElbowType, hard: boolean, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const spec = OVAL_ELBOWS[type];
  const angle = spec.angle * DEG;
  const R = 1.5 * (hard ? kit.A : kit.minor);
  const S = Math.min(220, 96 + Math.round(kit.perimeter(kit.R0) * 1.2));
  const rib = Math.min(0.34, 0.04 + kit.eqD * 0.012);
  const bead = rib * 0.8;
  const group = new THREE.Group();
  const seams = goreSeams(spec.angle, spec.pieces).map((a) => a * DEG);
  // End gores are tangent at the ends of the turn, middle gores at their middle (same as the round gored elbows).
  const tangents = seams.slice(0, -1).map((a, k) => (k === 0 ? 0 : k === seams.length - 2 ? angle : (a + seams[k + 1]) / 2));
  let vBase = COLLAR;
  tangents.forEach((t, k) => {
    const a0 = seams[k];
    const a1 = seams[k + 1];
    group.add(new THREE.Mesh(gore(kit, hard, R, kit.R0, t, a0, a1, vBase, S), metal));
    group.add(new THREE.Mesh(gore(kit, hard, R, kit.R0 - kit.wall, t, a0, a1, vBase, S), inside));
    vBase += 2 * R * Math.tan((a1 - a0) / 2) + 3;
  });
  for (let k = 1; k < seams.length - 1; k++) {
    const loop = new JointLoop(kit, hard, R, kit.R0 + rib * 0.35, tangents[k - 1], seams[k]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(loop, S, rib, 8, true), seam));
  }
  const ends = ([0, 1] as const).map((e) => {
    const f = endFrame(e, R, angle, hard);
    f.add(buildCollar(kit, style, mats, bead, S));
    group.add(f);
    return f;
  });
  return { group, ends, R };
}

type Screws = NonNullable<BuiltConnection["screws"]>;
type Joint = { moving: { obj: THREE.Object3D; from: number; to: number }[]; screws: Screws };

/** Slip joint (coupling): the 12" oval duct slides over the crimped elbow end up to the bead; screws go in over the crimp. */
function slipJoint(kit: Kit, frame: THREE.Group, mats: Mats, screwMat: THREE.Material): Joint {
  const gap = kit.eqD <= 16 ? 2 : 2.5;
  const duct = buildOvalPipe(kit, mats);
  duct.position.x = gap + JOIN_LENGTH / 2;
  frame.add(duct);
  const stop = CRIMP_X - 0.03;
  const x = (CRIMP_X + CRIMP_TAPER) / 2 - 0.15;
  const n = screwCount(kit.eqD);
  const k = screwScale(kit.eqD);
  const group = new THREE.Group();
  const items: Screws["items"] = [];
  const each = 0.4;
  for (let i = 0; i < n; i++) {
    const [y, z, ny, nz] = kit.point((i + 0.25) / n, kit.R0);
    const obj = new THREE.Group();
    obj.position.set(x, y, z);
    obj.rotation.x = Math.atan2(nz, ny);
    const s = screwMesh(k, screwMat);
    obj.add(s.obj);
    group.add(obj);
    const start = (i / Math.max(1, n - 1)) * (1 - each);
    items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
  }
  frame.add(group);
  return { moving: [{ obj: duct, from: 0, to: stop - gap }], screws: { group, items } };
}

/** Flanged joint: same as the oval duct's (flange in the elbow end, gasket, flange on the 12" duct, screws through). */
function flangeJoint(kit: Kit, frame: THREE.Group, mats: Mats, ringMat: THREE.Material, sheet: THREE.Material, gasketMat: THREE.Material, screwMat: THREE.Material): Joint {
  const R = kit.R0;
  const rc = R - kit.wall - 0.03;
  const ro = R + 1.5;
  const t = 0.075;
  const segs = 220;
  const uv = 1 / TEX_LENGTH;
  const part = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(kit.ring(ro, rc, t, segs, uv), ringMat));
    g.add(new THREE.Mesh(kit.shell([-2, 0], segs, () => rc, uv, rc), sheet));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(ro, t / 2), segs, 0.07, 8, true), ringMat));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(rc + 0.02, -0.4), segs, 0.08, 8, true), sheet));
    return g;
  };
  const a = part();
  const b = part();
  b.rotation.y = Math.PI;
  const gt = 0.125;
  const gap = 1;
  const gasket = new THREE.Mesh(kit.ring(ro - 0.02, R + 0.06, gt, segs, uv), gasketMat);
  gasket.position.x = t + gap;
  const joinStart = t + gap + gt + gap + t;
  b.position.x = joinStart;
  frame.add(a, gasket, b);
  const duct = buildOvalPipe(kit, mats);
  duct.position.x = joinStart + JOIN_LENGTH / 2;
  frame.add(duct);
  // Screws through both rings and the gasket, parallel to the duct.
  const n = flangeScrewCount(kit.eqD);
  const k = screwScale(kit.eqD);
  const rs = (R + 0.06 + ro - 0.02) / 2;
  const group = new THREE.Group();
  const items: Screws["items"] = [];
  const each = 0.4;
  for (let i = 0; i < n; i++) {
    const [y, z] = kit.point((i + 0.5) / n, rs);
    const obj = new THREE.Group();
    obj.position.set(2 * t + gt, y, z);
    obj.rotation.z = -Math.PI / 2;
    const s = screwMesh(k, screwMat);
    obj.add(s.obj);
    group.add(obj);
    const start = (i / Math.max(1, n - 1)) * (1 - each);
    items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
  }
  frame.add(group);
  const to = -2 * gap;
  return {
    moving: [
      { obj: gasket, from: 0, to: -gap },
      { obj: b, from: 0, to },
      { obj: duct, from: 0, to },
    ],
    screws: { group, items },
  };
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

const CONNECTION_TEXT: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "The elbow end is crimped past the bead. The oval duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Straight elbow ends, no beads. A flange goes in the elbow end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

type Model = { type: OvalElbowType; bend: OvalBend; A: number; minor: number };

export default function OvalElbow3D({ type: type0, bend: bend0, onClose }: { type: OvalElbowType; bend: OvalBend; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setModel: (m: Model) => void;
    setConnection: (c: Connection) => void;
    setTopInset: (px: number) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [type, setType] = useState<OvalElbowType>(type0);
  const [bend, setBend] = useState<OvalBend>(bend0);
  const [A, setA] = useState(DEFAULT_A);
  const [minor, setMinor] = useState(DEFAULT_MINOR);
  const [connection, setConnection] = useState<Connection>("none");
  const [play, setPlay] = useState<PlayState>("idle");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const spec = OVAL_ELBOWS[type];
  const hard = bend === "hard";

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

    const spangle = spangleTexture();
    const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangle, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95 });
    const seam = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const inside = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.7, roughness: 0.5, side: THREE.BackSide, envMapIntensity: 0.6 });
    const sheet = metal.clone();
    sheet.side = THREE.DoubleSide;
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4 });
    const mats: Mats = { metal, inside, seam };

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 4000);
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
    let scale = DEFAULT_A;
    const frame = () => {
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
      const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.04 + scale / 4;
      camera.position.copy(view.clone().normalize().multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.minDistance = scale * 0.9;
      controls.maxDistance = dist * 2.2;
      camera.near = Math.max(0.1, scale * 0.05);
      camera.far = dist * 6;
      project();
      controls.update();
    };

    let moving: { obj: THREE.Object3D; base: number; from: number; to: number }[] = [];
    let screws: Screws["items"] = [];
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

    let current: Model = { type: type0, bend: bend0, A: DEFAULT_A, minor: DEFAULT_MINOR };
    let currentC: Connection = "none";
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const { type, bend, A, minor } = current;
      const kit = ovalKit(A, minor);
      const hard = bend === "hard";
      const style: EndStyle = currentC === "coupling" ? "crimp" : currentC === "flange" ? "plain" : "bead";
      const { group: elbow, ends } = buildOvalElbow(kit, type, hard, mats, style);
      // Connection on the bottom end (the duct hangs straight down under the elbow), same as the round elbows.
      const joint = currentC === "coupling" ? slipJoint(kit, ends[0], mats, screwMat) : currentC === "flange" ? flangeJoint(kit, ends[0], mats, metal, sheet, gasketMat, screwMat) : null;
      moving = joint ? joint.moving.map((m) => ({ ...m, base: m.obj.position.x })) : [];
      screws = joint ? joint.screws.items : [];
      stopPlay();
      // Bottom end on the left, the other end out to the right, as drawn on the sheet.
      elbow.rotation.y = Math.PI;
      elbow.updateMatrixWorld(true);
      elbow.position.sub(new THREE.Box3().setFromObject(elbow).getCenter(new THREE.Vector3()));
      model = new THREE.Group();
      model.add(elbow);
      scene.add(model);
      spangle.repeat.set(Math.max(2, Math.round(kit.perimeter(kit.R0) / 10)), TEX_LENGTH / 10);
      scale = A;
      renderer.domElement.setAttribute(
        "aria-label",
        `3D ${OVAL_ELBOWS[type].code} oval elbow, ${A} by ${minor} inches, ${hard ? "hard" : "easy"} bend. Drag to turn, pinch to zoom.`,
      );
      frame();
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
    build();
    const ro = new ResizeObserver(() => {
      resize();
      frame();
    });
    ro.observe(el);

    api.current = {
      setModel: (m) => {
        if (m.type === current.type && m.bend === current.bend && m.A === current.A && m.minor === current.minor) return;
        current = m;
        build();
      },
      setConnection: (c) => {
        if (c === currentC) return;
        currentC = c;
        build();
      },
      setTopInset: (px) => {
        if (Math.abs(px - inset) < 1) return;
        inset = px;
        frame();
      },
      reset: () => {
        stopPlay();
        frame();
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
      [metal, seam, inside, sheet, screwMat, gasketMat].forEach((m) => m.dispose());
      [spangle, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    api.current?.setModel({ type, bend, A, minor });
  }, [type, bend, A, minor]);
  useEffect(() => {
    api.current?.setConnection(connection);
  }, [connection]);
  // Keep the link in step with the type and bend shown (replace, so Back still closes the model).
  useEffect(() => {
    if (location.hash.startsWith(SWFO_ELBOW_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + ovalElbowHash(type, bend));
  }, [type, bend]);
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

  const minors = ovalMinorsFor(A);
  const size = ovalSize(A, minor);
  const pickA = (next: number) => {
    setA(next);
    const ms = ovalMinorsFor(next);
    if (!ms.includes(minor)) setMinor(ms.reduce((best, m) => (Math.abs(m - minor) < Math.abs(best - minor) ? m : best), ms[0]));
  };
  const R = 1.5 * (hard ? A : minor);
  const seams = goreSeams(spec.angle, spec.pieces);
  const endGore = seams[1];
  const midGore = spec.pieces > 2 ? seams[2] - seams[1] : 0;
  const goreText =
    spec.pieces > 2
      ? `two ${degs(endGore)} end gores, ${spec.pieces - 2} × ${degs(midGore)} middle`
      : `two ${degs(endGore)} gores`;
  const info =
    connection !== "none"
      ? CONNECTION_TEXT[connection]
      : {
          title: `${spec.name} (${spec.code})`,
          text: `${hard ? "Hard" : "Easy"} bend: turns ${hard ? "the wide way, A in the bend" : "the flat way, α in the bend"}, R = 1.5 × ${hard ? "A" : "α"}. ${spec.pieces} pieces (${goreText}), 2″ straight collars.`,
        };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]" role="dialog" aria-modal="true" aria-label="Oval elbows 3D model">
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Single Wall Oval · {spec.name} ({spec.code})</p>
        </div>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/15 active:bg-white/25" aria-label="Close 3D model">
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
        {hint && !failed && <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-steel">Drag to turn · pinch to zoom</p>}
      </div>
      <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2.5 short:pt-1.5" role="radiogroup" aria-label="Connection">
        <div className="grid h-9 grid-cols-3 items-end gap-2 short:h-8">
          <span className="col-span-2 text-[11px] font-medium tracking-wide text-muted uppercase">Connection</span>
          {connection !== "none" && !failed && (
            <button
              type="button"
              onClick={() => api.current?.play()}
              aria-label={play === "playing" ? "Pause" : play === "done" ? "Replay how it goes together" : "Play how it goes together"}
              className="btn-raised btn-raised-sm mb-1 flex h-8 items-center justify-center gap-1.5 rounded-[0.65rem] font-display text-base leading-none short:h-7"
            >
              {play === "playing" ? <Pause className="size-4" aria-hidden="true" /> : play === "done" ? <RotateCw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
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
      <div className="grid grid-cols-4 gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label="Oval elbow type">
        {OVAL_ELBOW_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            aria-label={`${OVAL_ELBOWS[t].name} (${OVAL_ELBOWS[t].code})`}
            onClick={() => setType(t)}
            className="btn-raised btn-raised-sm flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] px-1 font-display text-lg leading-none short:h-9"
          >
            {OVAL_ELBOWS[t].code}
            <span className="font-sans text-[10px] leading-none font-medium tracking-wider uppercase opacity-75">{OVAL_ELBOWS[t].short}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 items-center gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label="Bend">
        <span className="text-[11px] leading-tight font-medium tracking-wide text-muted uppercase">
          Bend
          <span className="block tracking-normal normal-case">R = 1.5 × {hard ? "A" : "α"}</span>
        </span>
        {OVAL_BENDS.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={bend === b}
            aria-label={b === "hard" ? "Hard bend (R = 1.5 × A)" : "Easy bend (R = 1.5 × α)"}
            onClick={() => setBend(b)}
            className="btn-raised btn-raised-sm h-9 rounded-[0.65rem] font-display text-lg leading-none short:h-8"
          >
            {b === "hard" ? "Hard" : "Easy"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-surface/90 px-3 py-2.5" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <label className="flex w-[4.75rem] min-w-0 shrink-0 flex-col">
          <span className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">A · major</span>
          <select
            value={A}
            onChange={(e) => pickA(Number(e.target.value))}
            aria-label="Size A (major axis)"
            className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
          >
            {OVAL_MAJORS.map((d) => (
              <option key={d} value={d}>
                {d}&Prime;
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-[4.75rem] min-w-0 shrink-0 flex-col">
          <span className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
            <span className="normal-case">α</span> · minor
          </span>
          <select
            value={minor}
            onChange={(e) => setMinor(Number(e.target.value))}
            aria-label="Size α (minor axis)"
            className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
          >
            {minors.map((d) => (
              <option key={d} value={d}>
                {d}&Prime;
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1 text-xs leading-snug text-ink" data-testid="oval-elbow-info">
          <p className="truncate">
            R = <b className="font-semibold">{inches(R)}&Prime;</b> · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
          </p>
          <p className="truncate text-muted">Gauge assumed (oval chart)</p>
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
