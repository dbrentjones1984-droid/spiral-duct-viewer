import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONNECTIONS, flangeScrewCount, JOIN_LENGTH, samples, screwCount, screwMesh, screwScale, type BuiltConnection, type Connection } from "@/components/duct-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";
import { OVAL_BENDS, OVAL_CTEE_TYPES, OVAL_ELBOW_TYPES, OVAL_LAT_TYPES, OVAL_LLTEE_TYPES, OVAL_RED_TYPES, OVAL_TEE_TYPES, OVAL_WYE_TYPES, OVAL_CAP_TYPES, ovalCteeHash, ovalElbowHash, ovalLatHash, ovalLlteeHash, ovalMiterHash, ovalRedHash, ovalTeeHash, ovalWyeHash, ovalCapHash, SWFO_CTEE_3D_HASH, SWFO_ELBOW_3D_HASH, SWFO_LAT_3D_HASH, SWFO_LLTEE_3D_HASH, SWFO_MITER_3D_HASH, SWFO_RED_3D_HASH, SWFO_TEE_3D_HASH, SWFO_WYE_3D_HASH, SWFO_CAP_3D_HASH, type OvalBend, type OvalCteeType, type OvalElbowType, type OvalLatType, type OvalLlteeType, type OvalRedType, type OvalTeeType, type OvalWyeType, type OvalCapType } from "@/lib/route";
import { OVAL_MAJORS, OVAL_SIZES, ovalMinorsFor, ovalSize } from "@/lib/oval-sizes";

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
 *
 * The same viewer also shows the Mitered Elbows sheet (oval fittings sheet 2), kind "miter": 02PV90 H / E, a 90°
 * 2-piece mitered elbow with turning vanes. Hard (H) = A in the bend plane, easy (E) = α in it, as above. Each leg runs
 * 4" past the other leg's wall (the throat corner), its 2" collar included, as drawn; vanes as the round MEV90's (count
 * by the size in the bend plane), with the walls shown see-through so they read.
 * And the Tees and Crosses sheet (oval fittings sheet 3), kind "tee": 0T90 / 0RT90 / 0C180 / 0RC180 with a type picker,
 * oval branches on the main's rounded (minor) side in a saddle (major axis along the main), L = branch + 3" between the 2" ends, the R types
 * through a concentric oval reducer to the outlet (round CR table by the major axis reduction). Connection on the
 * right (outlet) end; see buildOvalTee().
 * And the Conical Tees and Conical Crosses sheet (oval fittings sheet 4), kind "ctee": OCT90 / ORCT90 / OCC180 / ORCC180,
 * the same fitting with conical branches (the round CT90's cone: 5" tall from the main's crown to the 2" collar, flaring
 * 1" each side along the main), L = branch + 5".
 * And the Low-Loss Tees and Crosses sheet (oval fittings sheet 5), kind "lltee": OT90-L / ORT90-L / OC180-L / ORC180-L,
 * branches with a low-loss sweep on the upstream side (straight downstream), T = 4" to the 2" collar, L = branch + 7".
 * And the Laterals sheet (oval fittings sheet 6), kind "lat": OL45 / ORL45 / OLC45 / ORLC45, the same fitting with the
 * branches at 45° leaning to the outlet (the round L45's convention: 2" straight past the main on the short side, then
 * the 2" collar), L = top branch x 1.414 + 3" (to the nearest 1/2").
 * And the Concentric and Eccentric Reducer sheet (oval fittings sheet 7), kind "red": CR / ER, A x α in to B x b out,
 * 2" collars and the transition R between; see buildOvalReducer().
 * And the Wye and Reducing Wye sheet (oval fittings sheet 8), kind "wye": Y45 / RY45, inlet A x α and two 45° legs
 * (the round Y45 / RY45's convention), RY45's legs reduced to B x b / C x c by the CR table; see buildOvalWye().
 * And the couplings & ends sheet (oval fittings sheet 9), kind "cap": PC / FC / OEC / OF / BM, each shown with the
 * see-through oval duct or fitting ends it goes on, as the round sheet 10 card; see buildOvalCap().
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

// ---- Mitered elbow with vanes (02PV90 H / E, oval fittings sheet 2). ----
/** Each leg runs MITER_LEG past the other leg's wall (the throat corner), its 2" collar included (sheet's 4"). */
const MITER_LEG = 4;
/**
 * Turning vanes by the size in the bend plane (A for hard, α for easy): the round MEV90 table (sheet), plus one vane
 * under 8" (assumed: the oval sheet draws every 02PV90 with vanes, the round table starts at 8").
 */
const VANE_TABLE = [
  { from: 0, to: 7, n: 1 },
  { from: 8, to: 9, n: 2 },
  { from: 10, to: 14, n: 3 },
  { from: 15, to: 19, n: 4 },
  { from: 20, to: 999, n: 5 },
] as const;
export function ovalVanes(p: number) {
  const row = VANE_TABLE.find((v) => p >= v.from && p <= v.to) ?? VANE_TABLE[VANE_TABLE.length - 1];
  return { n: row.n, range: row.from === 0 ? `under 8″` : row.to >= 999 ? `${row.from}″ and up` : `${row.from}″–${row.to}″` };
}

/** Half the in-plane size of the section (q runs -h..h) and the out-of-plane half height at q, for end radius rho. */
function sectionHalf(kit: Kit, hard: boolean, rho: number) {
  const F2 = kit.F / 2;
  const h = hard ? F2 + rho : rho;
  const w = (q: number) => {
    const a = Math.abs(q);
    if (a >= h) return 0;
    return hard ? (a <= F2 ? rho : Math.sqrt(Math.max(0, rho * rho - (a - F2) * (a - F2)))) : F2 + Math.sqrt(Math.max(0, rho * rho - a * a));
  };
  return { h, w };
}

/** Grid (rows x cols, row-major) with the given normals; triangles wound to face along them. */
function orientedGrid(pos: number[], nor: number[], uv: number[], rows: number, cols: number) {
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + cols;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const v = (k: number) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  let dot = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const p0 = v(idx[t]);
    const n = new THREE.Vector3().crossVectors(v(idx[t + 1]).sub(p0), v(idx[t + 2]).sub(p0));
    dot += n.x * nor[idx[t] * 3] + n.y * nor[idx[t] * 3 + 1] + n.z * nor[idx[t] * 3 + 2];
  }
  if (dot < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Miter frame (bend plane XY, B = Z): leg 0 comes up along +Y (centreline x = 0), leg 1 leaves along +X (centreline
 * y = 0). In-plane offset q: leg 0 at x = q, leg 1 at y = -q (q > 0 is the throat side). The cut is the line y = -x,
 * from the heel (-h, h) to the throat corner (h, -h). Points on the leg surface at section point u, along-leg s.
 */
function miterLegGeo(kit: Kit, hard: boolean, leg: 0 | 1, rho: number, end: number, S: number) {
  const rows = 3;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j <= S; j++) {
      const { q, w, nq, nw } = profile(kit, hard, j / S, rho);
      // leg 0 runs from y = end (< 0) up to the cut y = -q; leg 1 from the cut x = q out to x = end (> 0)
      const s0 = leg === 0 ? end : q;
      const s1 = leg === 0 ? -q : end;
      const s = s0 + ((s1 - s0) * i) / (rows - 1);
      if (leg === 0) {
        pos.push(q, s, w);
        nor.push(nq, 0, nw);
        uv.push(j / S, s / TEX_LENGTH);
      } else {
        pos.push(s, -q, w);
        nor.push(0, -nq, nw);
        uv.push(j / S, (s + 37) / TEX_LENGTH);
      }
    }
  }
  return orientedGrid(pos, nor, uv, rows, S + 1);
}

/** The seam along the cut: the stretched oval where the two pieces meet. */
class MiterCut extends THREE.Curve<THREE.Vector3> {
  constructor(
    private kit: Kit,
    private hard: boolean,
    private rho: number,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const { q, w } = profile(this.kit, this.hard, u, this.rho);
    return target.set(q, -q, w);
  }
}

/**
 * Turning vanes along the cut, same style as the round MEV90's: n quarter-arc blades, each with its middle on the cut,
 * leading edge along the incoming flow (+Y) and trailing edge along the outgoing flow (+X), at even steps from heel to
 * throat; each spans the duct's full height out of the bend plane (out to the oval wall at that point).
 */
function buildMiterVanes(kit: Kit, hard: boolean, n: number, mat: THREE.Material, edge: THREE.Material) {
  const g = new THREE.Group();
  const rin = kit.R0 - kit.wall - 0.02;
  const { h, w } = sectionHalf(kit, hard, rin);
  const step = (2 * h) / (n + 1);
  const a = step * 1.05;
  const H = Math.SQRT1_2;
  // which leg a point is in (below the cut: leg 0, offset x; above: leg 1, offset -y)
  const half = (x: number, y: number) => w(y < -x ? x : -y);
  const us = 24;
  for (let k = 0; k < n; k++) {
    const m = -h + step * (k + 1);
    const cx = m + a * H;
    const cy = -m - a * H;
    const arc: [number, number][] = [];
    for (let i = 0; i <= us; i++) {
      const th = (i / us) * (Math.PI / 2);
      arc.push([cx - a * Math.cos(th), cy + a * Math.sin(th)]);
    }
    vaneBlade(g, arc, half, Math.max(0.05, kit.eqD * 0.007), mat, edge);
  }
  return g;
}

/** One vane blade (as the round MEV90's): the arc swept across the duct, out to the wall each side, edged in a dark tube. */
function vaneBlade(g: THREE.Group, arc: [number, number][], half: (x: number, y: number) => number, edgeR: number, mat: THREE.Material, edge: THREE.Material) {
  const us = arc.length - 1;
  const vs = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const [x, y] of arc) {
    const hh = half(x, y);
    for (let j = 0; j <= vs; j++) pos.push(x, y, -hh + (2 * hh * j) / vs);
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
  const ring: THREE.Vector3[] = [];
  const at = (i: number, j: number) => new THREE.Vector3(pos[(i * (vs + 1) + j) * 3], pos[(i * (vs + 1) + j) * 3 + 1], pos[(i * (vs + 1) + j) * 3 + 2]);
  for (let i = 0; i <= us; i++) ring.push(at(i, vs));
  for (let j = vs - 1; j >= 0; j--) ring.push(at(us, j));
  for (let i = us - 1; i >= 0; i--) ring.push(at(i, 0));
  for (let j = 1; j < vs; j++) ring.push(at(0, j));
  const path = new THREE.CatmullRomCurve3(ring, true, "centripetal");
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path, ring.length * 2, edgeR, 5, true), edge));
}

/** End frame of a miter leg: origin at the open end's centre, +X out, local Z along the major axis (as endFrame). */
function miterEndFrame(leg: 0 | 1, h: number, hard: boolean) {
  const out = leg === 0 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(1, 0, 0);
  const inPlane = leg === 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const major = hard ? inPlane : B.clone();
  const y = new THREE.Vector3().crossVectors(major, out);
  const g = new THREE.Group();
  g.position.copy(out).multiplyScalar(h + MITER_LEG);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(out, y, major));
  return g;
}

/** 02PV90: two straight oval legs meeting on a sharp 45° cut, the seam along it, 2" collars, and the turning vanes. */
function buildOvalMiter(kit: Kit, hard: boolean, mats: Mats, style: EndStyle, vanes: number, vaneMat: THREE.Material, vaneEdge: THREE.Material) {
  const { metal, inside, seam } = mats;
  const group = new THREE.Group();
  const S = Math.min(220, 96 + Math.round(kit.perimeter(kit.R0) * 1.2));
  const rib = Math.min(0.34, 0.04 + kit.eqD * 0.012);
  const bead = rib * 0.8;
  const { h } = sectionHalf(kit, hard, kit.R0);
  const reach = h + MITER_LEG - COLLAR; // body ends where the collar starts
  ([0, 1] as const).forEach((leg) => {
    const end = leg === 0 ? -reach : reach;
    group.add(new THREE.Mesh(miterLegGeo(kit, hard, leg, kit.R0, end, S), metal));
    group.add(new THREE.Mesh(miterLegGeo(kit, hard, leg, kit.R0 - kit.wall, end, S), inside));
  });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new MiterCut(kit, hard, kit.R0 + rib * 0.35), S, rib, 8, true), seam));
  if (vanes > 0) group.add(buildMiterVanes(kit, hard, vanes, vaneMat, vaneEdge));
  const ends = ([0, 1] as const).map((leg) => {
    const f = miterEndFrame(leg, h, hard);
    f.add(buildCollar(kit, style, mats, bead, S));
    group.add(f);
    return f;
  });
  return { group, ends };
}

// ---- Tees & crosses (0T90 / 0RT90 / 0C180 / 0RC180, oval fittings sheet 3). ----
/**
 * Branches on the main's minor side, the narrow rounded edge, as the sheet draws them. Built with the main along X, its
 * minor axis α in Y and A in Z, the branches out along ±Z off the semicircular edges (centred at z = ±F/2, radius α/2);
 * the whole fitting is then turned so the branches point up and down (A vertical). Each branch is a flat oval with its
 * major axis along the main (X) and its minor across it (Y), so its outline lands on the round edge in a saddle like the
 * round T90/C180's: the branch's minor b must fit the edge (b ≤ α). It runs OTEE_BRANCH past the edge's crown, its 2"
 * collar included (as the round tees'; assumed).
 */
const OTEE_BRANCH = 4;
const OTEE_EXTRA = 3;
/**
 * Conical branches (sheet 4), the round CT90's convention: the cone runs OCONE_H (5") from the main's crown (the top of
 * its rounded edge) to the 2" collar, flaring OCONE_FLARE (1") each side along the main (base = B + 2" at the crown; the
 * sheet shows no number), keeping the branch's minor b across. L = B + OCTEE_EXTRA (5").
 */
const OCONE_H = 5;
const OCONE_FLARE = 1;
const OCTEE_EXTRA = 5;
/**
 * Low-loss branches (sheet 5): T = 4" from the main's crown up to the 2" collar; on the upstream (inlet, left) side the
 * branch sweeps OLL_SWEEP (3") out along the main, curving up into the collar; the downstream side is straight.
 * L = B + 7" = 2" + 3" sweep + B + 2", so the footprint (sweep + B) sits centred on the main and the collar is
 * OLL_SWEEP / 2 (1.5") downstream of centre.
 */
const OLL_T = 4;
const OLL_SWEEP = 3;
const OLLTEE_EXTRA = 7;
export type OvalSz = { A: number; a: number };
export type OvalAnyTee = OvalTeeType | OvalCteeType | OvalLlteeType | OvalLatType;
type OvalTeeSpec = {
  code: string;
  name: string;
  short: string;
  reducing: boolean;
  cross: boolean;
  cone?: boolean;
  lowLoss?: boolean;
  lateral?: boolean;
  labels: { out?: string; top: string; bottom?: string };
  lRule: string;
  defaults: { out?: OvalSz; top: OvalSz; bottom?: OvalSz };
};
export const OVAL_TEES: Record<OvalAnyTee, OvalTeeSpec> = {
  "0t90": { code: "0T90", name: "Tee 90°", short: "Tee", reducing: false, cross: false, labels: { top: "B×b · branch" }, lRule: "B + 3″", defaults: { top: { A: 18, a: 10 } } },
  "0rt90": {
    code: "0RT90",
    name: "Reducing Tee 90°",
    short: "Red. tee",
    reducing: true,
    cross: false,
    labels: { out: "B×b · outlet", top: "C×c · branch" },
    lRule: "C + 3″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 } },
  },
  "0c180": {
    code: "0C180",
    name: "Cross 180°",
    short: "Cross",
    reducing: false,
    cross: true,
    labels: { top: "B×b · top", bottom: "C×c · bottom" },
    lRule: "B + 3″",
    defaults: { top: { A: 18, a: 10 }, bottom: { A: 14, a: 8 } },
  },
  "0rc180": {
    code: "0RC180",
    name: "Reducing Cross 180°",
    short: "Red. cross",
    reducing: true,
    cross: true,
    labels: { out: "B×b · outlet", top: "C×c · top", bottom: "D×d · bottom" },
    lRule: "C + 3″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 }, bottom: { A: 12, a: 6 } },
  },
  oct90: { code: "OCT90", name: "Conical Tee 90°", short: "Con. tee", reducing: false, cross: false, cone: true, labels: { top: "B×b · branch" }, lRule: "B + 5″", defaults: { top: { A: 18, a: 10 } } },
  orct90: {
    code: "ORCT90",
    name: "Reducing Conical Tee 90°",
    short: "Red. c. tee",
    reducing: true,
    cross: false,
    cone: true,
    labels: { out: "B×b · outlet", top: "C×c · branch" },
    lRule: "C + 5″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 } },
  },
  occ180: {
    code: "OCC180",
    name: "Conical Cross 180°",
    short: "Con. cross",
    reducing: false,
    cross: true,
    cone: true,
    labels: { top: "B×b · top", bottom: "C×c · bottom" },
    lRule: "B + 5″",
    defaults: { top: { A: 18, a: 10 }, bottom: { A: 14, a: 8 } },
  },
  orcc180: {
    code: "ORCC180",
    name: "Reducing Conical Cross 180°",
    short: "Red. c. cross",
    reducing: true,
    cross: true,
    cone: true,
    labels: { out: "B×b · outlet", top: "C×c · top", bottom: "D×d · bottom" },
    lRule: "C + 5″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 }, bottom: { A: 12, a: 6 } },
  },
  "ot90-l": { code: "OT90-L", name: "Tee 90°", short: "LL tee", reducing: false, cross: false, lowLoss: true, labels: { top: "B×b · branch" }, lRule: "B + 7″", defaults: { top: { A: 18, a: 10 } } },
  "ort90-l": {
    code: "ORT90-L",
    name: "Reducing Tee 90°",
    short: "Red. LL tee",
    reducing: true,
    cross: false,
    lowLoss: true,
    labels: { out: "B×b · outlet", top: "C×c · branch" },
    lRule: "C + 7″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 } },
  },
  "oc180-l": {
    code: "OC180-L",
    name: "Cross 180°",
    short: "LL cross",
    reducing: false,
    cross: true,
    lowLoss: true,
    labels: { top: "B×b · top", bottom: "C×c · bottom" },
    lRule: "B + 7″",
    defaults: { top: { A: 18, a: 10 }, bottom: { A: 14, a: 8 } },
  },
  "orc180-l": {
    code: "ORC180-L",
    name: "Reducing Cross 180°",
    short: "Red. LL cross",
    reducing: true,
    cross: true,
    lowLoss: true,
    labels: { out: "B×b · outlet", top: "C×c · top", bottom: "D×d · bottom" },
    lRule: "C + 7″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 }, bottom: { A: 12, a: 6 } },
  },
  ol45: { code: "OL45", name: "Lateral 45°", short: "Lateral", reducing: false, cross: false, lateral: true, labels: { top: "B×b · branch" }, lRule: "B × 1.414 + 3″", defaults: { top: { A: 18, a: 10 } } },
  orl45: {
    code: "ORL45",
    name: "Reducing Lateral 45°",
    short: "Red. lat.",
    reducing: true,
    cross: false,
    lateral: true,
    labels: { out: "B×b · outlet", top: "C×c · branch" },
    lRule: "C × 1.414 + 3″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 } },
  },
  olc45: {
    code: "OLC45",
    name: "Lateral Cross 45°",
    short: "Lat. cross",
    reducing: false,
    cross: true,
    lateral: true,
    labels: { top: "B×b · top", bottom: "C×c · bottom" },
    lRule: "B × 1.414 + 3″",
    defaults: { top: { A: 18, a: 10 }, bottom: { A: 14, a: 8 } },
  },
  orlc45: {
    code: "ORLC45",
    name: "Reducing Lateral Cross 45°",
    short: "Red. l. cross",
    reducing: true,
    cross: true,
    lateral: true,
    labels: { out: "B×b · outlet", top: "C×c · top", bottom: "D×d · bottom" },
    lRule: "C × 1.414 + 3″",
    defaults: { out: { A: 19, a: 10 }, top: { A: 14, a: 8 }, bottom: { A: 12, a: 6 } },
  },
};
/** Flare along the main (each side) of a branch at distance s out from the main's axis: 0 for straight branches. */
type Flare = (s: number) => number;
const noFlare: Flare = () => 0;
/** A branch outline point (kit kb, end radius rb) with its flats stretched by ext each side along the main: [x, y, ny, nx]. */
function branchPt(kb: Kit, rb: number, u: number, ext: number): [number, number, number, number] {
  const [ym, zm, ny, nz] = kb.point(u, rb, kb.R0);
  const x = nz === 0 && kb.F > 0 ? (zm * (kb.F / 2 + ext)) / (kb.F / 2) : zm + Math.sign(zm) * ext;
  return [x, ym, ny, nz];
}
/** A low-loss branch outline point: its upstream (x < 0) half pushed e further upstream, flats stretched; then moved xc downstream. */
function lowLossPt(kb: Kit, rb: number, u: number, e: number, xc: number): [number, number, number, number] {
  const [ym, zm, ny, nz] = kb.point(u, rb, kb.R0);
  const x = nz === 0 && kb.F > 0 ? zm - (e * (kb.F / 2 - zm)) / kb.F : zm < 0 ? zm - e : zm;
  return [x + xc, ym, ny, nz];
}
/**
 * How a branch is shaped: pt(kb, rb, u, t, s) its outline point at height fraction t (0 at the main, 1 at the collar) and
 * distance s out; hole(sq, s) its hole's reach upstream (lo) and downstream (hi) of x = 0 on the main's surface at s out,
 * sq = the branch's rounded-end half width at that height; xc where its collar centre sits along the main.
 */
type BranchShape = {
  pt: (kb: Kit, rb: number, u: number, t: number, s: number) => [number, number, number, number];
  lo: (F: number, sq: number, s: number) => number;
  hi: (F: number, sq: number, s: number) => number;
  xc: number;
  smooth: boolean;
};
const straightShape: BranchShape = { pt: (kb, rb, u) => branchPt(kb, rb, u, 0), lo: (F, sq) => F / 2 + sq, hi: (F, sq) => F / 2 + sq, xc: 0, smooth: false };
const coneShape = (ext: Flare): BranchShape => ({
  pt: (kb, rb, u, _t, s) => branchPt(kb, rb, u, ext(s)),
  lo: (F, sq, s) => F / 2 + ext(s) + sq,
  hi: (F, sq, s) => F / 2 + ext(s) + sq,
  xc: 0,
  smooth: true,
});
/** Low-loss sweep out along the main at height fraction t: 3" at the main, easing (slightly curved) to 0 at the collar. */
const llSweep = (t: number) => OLL_SWEEP * Math.pow(Math.max(0, 1 - t), 1.5);
const LL_XC = OLL_SWEEP / 2;
const lowLossShape: BranchShape = {
  pt: (kb, rb, u, t) => lowLossPt(kb, rb, u, llSweep(t), LL_XC),
  lo: (F, sq) => F / 2 + OLL_SWEEP - LL_XC + sq,
  hi: (F, sq) => F / 2 + LL_XC + sq,
  xc: LL_XC,
  smooth: true,
};

/**
 * Oval reducer length R (the sheet: "refer to reducer drawing"): the round concentric reducer's CR table by the major
 * axis reduction A - B: 1"-4" -> 4", 5"-8" -> 8", 9"-12" -> 12", 13"-16" -> 16", past 16" on in 4" steps (assumed).
 */
export const OVAL_CR_TABLE_MAX = 16;
export function ovalReducerLength(A: number, B: number) {
  return B >= A ? 0 : Math.ceil((A - B) / 4) * 4;
}

/** Reach (along Z) of the main's rounded edge (end radius rho) at height y: the saddle the branches sit on. */
function mainEdge(kit: Kit, rho: number, y: number) {
  return kit.F / 2 + Math.sqrt(Math.max(0, rho * rho - y * y));
}
type TeeHole = { dir: 1 | -1; F: number; r: number; shape: BranchShape };
/** Reach (along X) of a branch's hole upstream and downstream of x = 0 at height y on the main's surface at s out. */
const holeReach = (h: TeeHole, y: number, s: number): [number, number] => {
  const sq = Math.sqrt(Math.max(0, h.r * h.r - y * y));
  return [h.shape.lo(h.F, sq, s), h.shape.hi(h.F, sq, s)];
};

/** The main between its 2" ends (x = -L/2..L/2) with the branches' holes cut out, as two halves (x < 0 and x > 0). */
function teeMainGeo(km: Kit, rho: number, L: number, holes: TeeHole[], S: number) {
  const at = (u: number) => km.point(u, rho);
  const which = (u: number) => {
    const [y, z] = at(u);
    return holes.findIndex((h) => h.dir * z > km.F / 2 - 1e-9 && Math.abs(y) < h.r);
  };
  const halfAt = (u: number): [number, number] => {
    const [y, z] = at(u);
    const k = which(u);
    return k < 0 ? [0, 0] : holeReach(holes[k], y, Math.abs(z));
  };
  // columns around the section; at each hole edge two columns at the same place, one each side of the step
  let cols: { u: number; h: [number, number] }[] = [];
  for (let j = 0; j <= S; j++) {
    const u = j / S;
    if (j > 0) {
      const u0 = (j - 1) / S;
      const k0 = which(u0);
      const k1 = which(u);
      if (k0 !== k1) {
        let lo = u0;
        let hi = u;
        for (let it = 0; it < 40; it++) {
          const mid = (lo + hi) / 2;
          if (which(mid) === k0) lo = mid;
          else hi = mid;
        }
        const ue = (lo + hi) / 2;
        const se = Math.abs(at(ue)[1]);
        const edge = (k: number): [number, number] => (k < 0 ? [0, 0] : [holes[k].shape.lo(holes[k].F, 0, se), holes[k].shape.hi(holes[k].F, 0, se)]);
        cols.push({ u: ue, h: edge(k0) }, { u: ue, h: edge(k1) });
      }
    }
    cols.push({ u, h: halfAt(u) });
  }
  for (let pass = 0; pass < 6; pass++) {
    const next = [cols[0]];
    for (let j = 1; j < cols.length; j++) {
      const p = cols[j - 1];
      const c = cols[j];
      if (c.u - p.u > 1e-5 && Math.max(Math.abs(c.h[0] - p.h[0]), Math.abs(c.h[1] - p.h[1])) > rho * 0.03 && which(p.u + 1e-9) === which(c.u - 1e-9)) {
        const m = (p.u + c.u) / 2;
        next.push({ u: m, h: halfAt(m) });
      }
      next.push(c);
    }
    cols = next;
  }
  const rows = 8;
  return ([-1, 1] as const).map((side) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (const c of cols) {
        const [y, z, ny, nz] = at(c.u);
        const h = c.h[side < 0 ? 0 : 1];
        const x = side * (h + ((L / 2 - h) * i) / rows);
        pos.push(x, y, z);
        nor.push(0, ny, nz);
        uv.push(c.u, (x + 40) / TEX_LENGTH);
      }
    }
    return orientedGrid(pos, nor, uv, rows + 1, cols.length);
  });
}

/** A branch (kit kb, end radius rb) out of the main's rounded edge (end radius rhoMain) on the dir side, out to |z| = yTo. */
function teeBranchGeo(km: Kit, rhoMain: number, kb: Kit, rb: number, dir: 1 | -1, yTo: number, S: number, shape: BranchShape = straightShape) {
  const rows = shape.smooth ? 12 : 8;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= S; j++) {
      const ym = kb.point(j / S, rb, kb.R0)[0];
      const s0 = mainEdge(km, rhoMain, ym);
      const s = s0 + ((yTo - s0) * i) / rows;
      const [x, y, ny, nz] = shape.pt(kb, rb, j / S, i / rows, s);
      pos.push(x, y, dir * s);
      nor.push(nz, ny, 0);
      uv.push(j / S, (11 + yTo - s) / TEX_LENGTH);
    }
  }
  const g = orientedGrid(pos, nor, uv, rows + 1, S + 1);
  if (shape.smooth) {
    // the cone / low-loss sweep leans out: smooth normals, the wrap-around seam columns averaged
    g.computeVertexNormals();
    const n = g.getAttribute("normal") as THREE.BufferAttribute;
    for (let i = 0; i <= rows; i++) {
      const p = i * (S + 1);
      const q = p + S;
      const v = new THREE.Vector3(n.getX(p) + n.getX(q), n.getY(p) + n.getY(q), n.getZ(p) + n.getZ(q)).normalize();
      n.setXYZ(p, v.x, v.y, v.z);
      n.setXYZ(q, v.x, v.y, v.z);
    }
  }
  return g;
}
/** A loop around a branch at distance s(ym) out (dir side), its outline pushed out by k. */
class BranchLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private kb: Kit,
    private k: number,
    private dir: 1 | -1,
    private sAt: (ym: number) => number,
    private shape: BranchShape,
    private t: number,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const ym = this.kb.point(u, this.kb.R0 + this.k, this.kb.R0)[0];
    const s = this.sAt(ym);
    const [x, y] = this.shape.pt(this.kb, this.kb.R0 + this.k, u, this.t, s);
    return target.set(x, y, this.dir * s);
  }
}

/** The seam where a branch meets the main, pushed out by k so it sits on both surfaces. */
class TeeSaddleLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private km: Kit,
    private kb: Kit,
    private k: number,
    private dir: 1 | -1,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const [ym, zm] = this.kb.point(u, this.kb.R0 + this.k, this.kb.R0);
    return target.set(zm, ym, this.dir * mainEdge(this.km, this.km.R0 + this.k, ym));
  }
}

/** Concentric oval reducer from the main (km) at x0 to the outlet (ko) at x1, end radii rm / ro. */
function teeReducerGeo(km: Kit, rm: number, ko: Kit, ro: number, x0: number, x1: number, S: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const rows = 6;
  for (let i = 0; i <= rows; i++) {
    const k = i / rows;
    for (let j = 0; j <= S; j++) {
      const [y0, z0, ny0, nz0] = km.point(j / S, rm, km.R0);
      const [y1, z1, ny1, nz1] = ko.point(j / S, ro, ko.R0);
      const x = x0 + (x1 - x0) * k;
      pos.push(x, y0 + (y1 - y0) * k, z0 + (z1 - z0) * k);
      nor.push(0, ny0 + (ny1 - ny0) * k, nz0 + (nz1 - nz0) * k);
      uv.push(j / S, x / TEX_LENGTH);
    }
  }
  const g = orientedGrid(pos, nor, uv, rows + 1, S + 1);
  g.computeVertexNormals();
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i <= rows; i++) {
    const p = i * (S + 1);
    const q = p + S;
    const v = new THREE.Vector3(n.getX(p) + n.getX(q), n.getY(p) + n.getY(q), n.getZ(p) + n.getZ(q)).normalize();
    n.setXYZ(p, v.x, v.y, v.z);
    n.setXYZ(q, v.x, v.y, v.z);
  }
  return g;
}

/** End frame at the open end p, +X out along `out`, local Z along the end's major axis (as endFrame). */
function teeEndFrame(p: THREE.Vector3, out: THREE.Vector3, major: THREE.Vector3) {
  const y = new THREE.Vector3().crossVectors(major, out);
  const g = new THREE.Group();
  g.position.copy(p);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(out, y, major));
  return g;
}

/**
 * Laterals (sheet 6), the round L45 / RL45 / LC45 / RLC45's convention: each branch a straight flat oval at 45° leaning
 * to the outlet (+X), its major axis in the plane of the main's axis and the branch's (so B lies along the main, tilted)
 * and its minor b across (b ≤ α), out of the main's rounded edge in a saddle. Its axis runs from (xc, 0, 0) along
 * (C45, 0, ±C45); xc = -crown puts the axis through the crown at x = 0, which centres the footprint (B x 1.414 at the
 * crown) on the body, 1-1/2" from each 2" end. OLAT_STRAIGHT (the sheet's inner 2") of straight branch past the main on
 * its short (downstream) side, then the 2" collar. L = top branch x 1.414 + 3", to the nearest 1/2" (as the round ones).
 */
const OLAT_FACTOR = 1.414;
const OLAT_EXTRA = 3;
const OLAT_STRAIGHT = 2;
const C45 = Math.SQRT1_2;
/** A lateral branch's hole on the main: at s out (|z|), x runs xc + s - sqrt2 (F/2 + sq) .. xc + s + sqrt2 (F/2 + sq). */
const latShape = (xc: number): BranchShape => ({
  pt: (kb, rb, u) => branchPt(kb, rb, u, 0),
  lo: (F, sq, s) => Math.SQRT2 * (F / 2 + sq) - xc - s,
  hi: (F, sq, s) => xc + s + Math.SQRT2 * (F / 2 + sq),
  xc,
  smooth: false,
});
/** Distance along a 45° branch's axis where its outline point (ym across, q along its major, + = upstream/heel) meets the main. */
const latS0 = (km: Kit, rho: number, ym: number, q: number) => mainEdge(km, rho, ym) * Math.SQRT2 - q;
/** A 45° oval branch (kit kb, end radius rb) out of the main's rounded edge (end radius rhoMain) on the dir side: saddle to s = sTo. */
function latBranchGeo(km: Kit, rhoMain: number, kb: Kit, rb: number, dir: 1 | -1, xc: number, sTo: number, S: number) {
  const rows = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= S; j++) {
      const [ym, q, ny, nq] = kb.point(j / S, rb, kb.R0);
      const s0 = latS0(km, rhoMain, ym, q);
      const s = s0 + ((sTo - s0) * i) / rows;
      pos.push(xc + (s - q) * C45, ym, dir * (s + q) * C45);
      nor.push(-nq * C45, ny, dir * nq * C45);
      uv.push(j / S, (11 + sTo - s) / TEX_LENGTH);
    }
  }
  return orientedGrid(pos, nor, uv, rows + 1, S + 1);
}
/** The saddle seam where a 45° branch meets the main, pushed out by k so it sits on both surfaces. */
class LatSaddleLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private km: Kit,
    private kb: Kit,
    private k: number,
    private dir: 1 | -1,
    private xc: number,
  ) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const [ym, q] = this.kb.point(u, this.kb.R0 + this.k, this.kb.R0);
    const s = latS0(this.km, this.km.R0 + this.k, ym, q);
    return target.set(this.xc + (s - q) * C45, ym, this.dir * (s + q) * C45);
  }
}

/** Body length L (branch + 3", the larger top branch's major axis; laterals B x 1.414 + 3") and reducer R of a tee/cross. */
export function ovalTeeDims(type: OvalAnyTee, main: OvalSz, out: OvalSz, top: OvalSz) {
  const t = OVAL_TEES[type];
  const L = t.lateral ? Math.round((top.A * OLAT_FACTOR + OLAT_EXTRA) * 2) / 2 : top.A + (t.lowLoss ? OLLTEE_EXTRA : t.cone ? OCTEE_EXTRA : OTEE_EXTRA);
  return { L, R: t.reducing ? ovalReducerLength(main.A, out.A) : 0 };
}

/**
 * 0T90 / 0RT90 / 0C180 / 0RC180: the main with its 2" ends (right end through the reducer to the outlet on the R types),
 * the branches with their seams and 2" collars. ends[0] is the right (outlet) end, where the connection goes.
 */
function buildOvalTee(type: OvalAnyTee, main: OvalSz, out: OvalSz, top: OvalSz, bottom: OvalSz | null, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const spec = OVAL_TEES[type];
  const km = ovalKit(main.A, main.a);
  const ko = spec.reducing ? ovalKit(out.A, out.a) : km;
  const { L, R } = ovalTeeDims(type, main, out, top);
  const outer = new THREE.Group();
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2; // branches (built along ±Z) up and down, A vertical
  outer.add(group);
  const Sm = Math.min(220, 96 + Math.round(km.perimeter(km.R0) * 1.2));
  const ribOf = (k: Kit) => Math.min(0.34, 0.04 + k.eqD * 0.012);
  const branches = ([
    [1, top],
    [-1, spec.cross ? bottom : null],
  ] as const)
    .filter((b): b is readonly [1 | -1, OvalSz] => !!b[1])
    .map(([dir, sz]) => ({ dir, kb: ovalKit(sz.A, sz.a) }));
  const crown = km.F / 2 + km.R0; // the rounded edge's crown
  // branch body (straight, the cone or the low-loss sweep) ends where its 2" collar starts
  const yTo = spec.lowLoss ? crown + OLL_T : spec.cone ? crown + OCONE_H : crown + OTEE_BRANCH - COLLAR;
  const latXc = -crown;
  const shape = spec.lateral ? latShape(latXc) : spec.lowLoss ? lowLossShape : spec.cone ? coneShape((sv) => (OCONE_FLARE * (yTo - sv)) / OCONE_H) : straightShape;
  for (const [rho, inner] of [
    [km.R0, false],
    [km.R0 - km.wall, true],
  ] as const) {
    const holes = branches.map(({ dir, kb }) => ({ dir, F: kb.F, r: inner ? kb.R0 - kb.wall : kb.R0, shape }));
    for (const g of teeMainGeo(km, rho, L, holes, Sm)) group.add(new THREE.Mesh(g, inner ? inside : metal));
  }
  const ends: THREE.Group[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  // right end first (the connection goes there), then the left A end
  const xr = L / 2 + R;
  if (R > 0) {
    const So = Math.min(220, 96 + Math.round(ko.perimeter(ko.R0) * 1.2));
    const S = Math.max(Sm, So);
    group.add(new THREE.Mesh(teeReducerGeo(km, km.R0, ko, ko.R0, L / 2, xr, S), metal));
    group.add(new THREE.Mesh(teeReducerGeo(km, km.R0 - km.wall, ko, ko.R0 - ko.wall, L / 2, xr, S), inside));
    const rib = ribOf(km);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new km.Loop(km.R0 + rib * 0.2, L / 2), Sm, rib * 0.8, 8, true), seam));
  }
  const fr = teeEndFrame(new THREE.Vector3(xr + COLLAR, 0, 0), X.clone(), Z.clone());
  fr.add(buildCollar(ko, style, mats, ribOf(ko) * 0.8, Math.min(220, 96 + Math.round(ko.perimeter(ko.R0) * 1.2))));
  const fl = teeEndFrame(new THREE.Vector3(-(L / 2 + COLLAR), 0, 0), X.clone().negate(), Z.clone());
  fl.add(buildCollar(km, style, mats, ribOf(km) * 0.8, Sm));
  ends.push(fr, fl);
  group.add(fr, fl);
  for (const { dir, kb } of branches) {
    const Sb = Math.min(220, 96 + Math.round(kb.perimeter(kb.R0) * 1.2));
    if (spec.lateral) {
      // 45° branch: straight to OLAT_STRAIGHT past the main on its short (downstream) side, where the 2" collar starts
      const sTo = crown * Math.SQRT2 + kb.A / 2 + OLAT_STRAIGHT;
      group.add(new THREE.Mesh(latBranchGeo(km, km.R0, kb, kb.R0, dir, latXc, sTo, Sb), metal));
      group.add(new THREE.Mesh(latBranchGeo(km, km.R0 - km.wall, kb, kb.R0 - kb.wall, dir, latXc, sTo, Sb), inside));
      const rib = ribOf(kb);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new LatSaddleLoop(km, kb, rib * 0.35, dir, latXc), Sb * 2, rib, 8, true), seam));
      const axis = new THREE.Vector3(C45, 0, dir * C45);
      const f = teeEndFrame(new THREE.Vector3(latXc, 0, 0).addScaledVector(axis, sTo + COLLAR), axis, new THREE.Vector3(-C45, 0, dir * C45));
      f.add(buildCollar(kb, style, mats, rib * 0.8, Sb));
      group.add(f);
      ends.push(f);
      continue;
    }
    group.add(new THREE.Mesh(teeBranchGeo(km, km.R0, kb, kb.R0, dir, yTo, Sb, shape), metal));
    group.add(new THREE.Mesh(teeBranchGeo(km, km.R0 - km.wall, kb, kb.R0 - kb.wall, dir, yTo, Sb, shape), inside));
    const rib = ribOf(kb);
    if (shape.smooth) {
      // seam where the cone / sweep meets the main (it follows the rounded edge), and where it meets the collar
      const k = rib * 0.35;
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new BranchLoop(kb, k, dir, (ym) => mainEdge(km, km.R0 + k, ym), shape, 0), Sb * 2, rib, 8, true), seam));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new BranchLoop(kb, rib * 0.2, dir, () => yTo, shape, 1), Sb, rib * 0.8, 8, true), seam));
    } else {
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new TeeSaddleLoop(km, kb, rib * 0.35, dir), Sb * 2, rib, 8, true), seam));
    }
    const f = teeEndFrame(new THREE.Vector3(shape.xc, 0, dir * (yTo + COLLAR)), new THREE.Vector3(0, 0, dir), X.clone());
    f.add(buildCollar(kb, style, mats, rib * 0.8, Sb));
    group.add(f);
    ends.push(f);
  }
  return { group: outer, ends, connKit: ko, L, R };
}

/**
 * Concentric and Eccentric Reducer (sheet 7): inlet A x α on the left, outlet B x b on the right, a 2" collar each end
 * and the transition R between (overall R + 4"). Built along X with the minor axis vertical (Y) and the major across
 * (Z), so the flat sides are top and bottom. CR: both ends on the same axis. ER: the bottom flat kept in line (the sheet's
 * side view has its bottom edge straight), so the outlet's centre sits (α - b) / 2 lower and the top slopes down; the
 * major axis stays centred (assumed: only the side view shows it; the end view and table do not say).
 * R by the reduction A - B, or α - b when that is larger (only the minor reduces; assumed): CR from its table
 * (1"-4" -> 4", 5"-8" -> 8", 9"-12" -> 12", 13"-16" -> 16", past 16" on in 4" steps, assumed); ER 6" for 1"-3", else
 * (A - B) x 1.5, to the nearest 1/2" (the table's second row gives no range; read as "4" and up").
 */
export const OVAL_REDS: Record<OvalRedType, { code: string; name: string; short: string }> = {
  cr: { code: "CR", name: "Concentric Reducer", short: "Concentric" },
  er: { code: "ER", name: "Eccentric Reducer", short: "Eccentric" },
};
export function ovalRedDims(type: OvalRedType, inl: OvalSz, out: OvalSz) {
  const byMajor = inl.A - out.A;
  const red = Math.max(byMajor, inl.a - out.a);
  const R = type === "cr" ? Math.max(4, Math.ceil(red / 4) * 4) : red <= 3 ? 6 : Math.round(red * 1.5 * 2) / 2;
  return { red, byMinor: red > byMajor, R, L: R + 2 * COLLAR, dy: type === "er" ? -(inl.a - out.a) / 2 : 0, past: type === "cr" && R > OVAL_CR_TABLE_MAX };
}
/** A point on the oval at t, a quarter of t for each flat (split at the middle of the top one) and each round end, so the flats of two sizes line up: [y, z, ny, nz]. */
function redPoint(kit: Kit, rho: number, t: number): [number, number, number, number] {
  const F = kit.F;
  const s = ((t % 1) + 1) % 1;
  const end = (a: number, cz: number): [number, number, number, number] => [Math.cos(a) * rho, cz + Math.sin(a) * rho, Math.cos(a), Math.sin(a)];
  if (s < 0.125) return [rho, (s / 0.125) * (F / 2), 1, 0];
  if (s < 0.375) return end(((s - 0.125) / 0.25) * Math.PI, F / 2);
  if (s < 0.625) return [-rho, F / 2 - ((s - 0.375) / 0.25) * F, -1, 0];
  if (s < 0.875) return end(Math.PI + ((s - 0.625) / 0.25) * Math.PI, -F / 2);
  return [rho, -F / 2 + ((s - 0.875) / 0.125) * (F / 2), 1, 0];
}
/** The reducer's transition: straight lines from the inlet oval (ki, end radius ri) at x0 to the outlet's (ko, ro) at x1, raised dy. */
function redTransGeo(ki: Kit, ri: number, ko: Kit, ro: number, x0: number, x1: number, dy: number, S: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const rows = 8;
  for (let i = 0; i <= rows; i++) {
    const k = i / rows;
    for (let j = 0; j <= S; j++) {
      const [y0, z0, ny0, nz0] = redPoint(ki, ri, j / S);
      const [y1, z1, ny1, nz1] = redPoint(ko, ro, j / S);
      const x = x0 + (x1 - x0) * k;
      pos.push(x, y0 + (y1 + dy - y0) * k, z0 + (z1 - z0) * k);
      nor.push(0, ny0 + (ny1 - ny0) * k, nz0 + (nz1 - nz0) * k);
      uv.push(j / S, x / TEX_LENGTH);
    }
  }
  const g = orientedGrid(pos, nor, uv, rows + 1, S + 1);
  g.computeVertexNormals();
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i <= rows; i++) {
    const p = i * (S + 1);
    const q = p + S;
    const v = new THREE.Vector3(n.getX(p) + n.getX(q), n.getY(p) + n.getY(q), n.getZ(p) + n.getZ(q)).normalize();
    n.setXYZ(p, v.x, v.y, v.z);
    n.setXYZ(q, v.x, v.y, v.z);
  }
  return g;
}
/** CR / ER: the transition with a seam at each end and the 2" collars. ends[0] is the outlet (B) end, where the connection goes. */
function buildOvalReducer(type: OvalRedType, inl: OvalSz, out: OvalSz, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const ki = ovalKit(inl.A, inl.a);
  const ko = ovalKit(out.A, out.a);
  const { R, dy } = ovalRedDims(type, inl, out);
  const group = new THREE.Group();
  const segs = (k: Kit) => Math.min(220, 96 + Math.round(k.perimeter(k.R0) * 1.2));
  const ribOf = (k: Kit) => Math.min(0.34, 0.04 + k.eqD * 0.012);
  const x0 = -R / 2;
  const x1 = R / 2;
  group.add(new THREE.Mesh(redTransGeo(ki, ki.R0, ko, ko.R0, x0, x1, dy, 256), metal));
  group.add(new THREE.Mesh(redTransGeo(ki, ki.R0 - ki.wall, ko, ko.R0 - ko.wall, x0, x1, dy, 256), inside));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new ki.Loop(ki.R0 + ribOf(ki) * 0.2, x0), segs(ki), ribOf(ki) * 0.8, 8, true), seam));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new ko.Loop(ko.R0 + ribOf(ko) * 0.2, x1), segs(ko), ribOf(ko) * 0.8, 8, true).translate(0, dy, 0), seam));
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const fr = teeEndFrame(new THREE.Vector3(x1 + COLLAR, dy, 0), X.clone(), Z.clone());
  fr.add(buildCollar(ko, style, mats, ribOf(ko) * 0.8, segs(ko)));
  const fl = teeEndFrame(new THREE.Vector3(x0 - COLLAR, 0, 0), X.clone().negate(), Z.clone());
  fl.add(buildCollar(ki, style, mats, ribOf(ki) * 0.8, segs(ki)));
  group.add(fr, fl);
  return { group, ends: [fr, fl], connKit: ko };
}
/** Outlet sizes for a reducer from main: B ≤ A and b ≤ α, not both equal; largest first. */
const redOutsFor = (main: OvalSz) =>
  OVAL_SIZES.filter((s) => s.A <= main.A && s.a <= main.a && !(s.A === main.A && s.a === main.a))
    .map((s) => ({ A: s.A, a: s.a }))
    .sort((p, q) => q.A - p.A || q.a - p.a);

/**
 * Wye and Reducing Wye (sheet 8), the round Y45 / RY45's (sheet 11) build adapted to oval: inlet A x α at the bottom
 * (along -Y), two legs at 45° each side of its centreline (90° apart) in the XY plane. The legs split across the major
 * (assumed, as the hard bends): every section has its major A in the XY plane (the drawing's width) and its minor α
 * along Z, so the front (a flat side) reads as the sheet's pentagon. The inlet is mitred at 22.5° each side, the legs
 * mitred onto it and onto each other on x = 0 (the centre seam up to the crotch). The sheet gives no leg length, so as
 * the round one (assumed): OWYE_STRAIGHT of leg past the crotch (each leg reaches A / 2 + 2" from the junction) and of
 * inlet below its lowest mitre point, then on RY45 a concentric reducer R (the oval CR table on the larger of the
 * major / minor reduction, as the reducer card) to B x b (left) / C x c (right), and every end's 2" collar.
 */
export const OVAL_WYES: Record<OvalWyeType, { code: string; name: string; short: string }> = {
  y45: { code: "Y45", name: "Wye 45°", short: "wye" },
  ry45: { code: "RY45", name: "Reducing Wye 45°", short: "reducing" },
};
const OWYE_STRAIGHT = 2;
const T22 = Math.tan(Math.PI / 8);
class FnCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private f: (u: number, v: THREE.Vector3) => THREE.Vector3) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    return this.f(u, target);
  }
}
/** The wye's sizes and each leg's reducer (Y45: none). */
export function ovalWyeDims(type: OvalWyeType, main: OvalSz, b: OvalSz, c: OvalSz) {
  const B = type === "ry45" ? b : main;
  const C = type === "ry45" ? c : main;
  const rB = type === "ry45" ? ovalRedDims("cr", main, B) : null;
  const rC = type === "ry45" ? ovalRedDims("cr", main, C) : null;
  const reach = main.A / 2 + OWYE_STRAIGHT;
  return { B, C, rB, rC, RB: rB?.R ?? 0, RC: rC?.R ?? 0, reach, past: !!(rB?.past || rC?.past) };
}
/** Leg on the side sd (+1 right, -1 left): axis b = (sd C45, C45, 0), section major X along p = (-sd C45, C45, 0) (towards the crotch), minor along Z; from the mitre (inlet side) or x = 0 (crotch side) to t = tEnd. */
function owyeLegGeo(kit: Kit, rho: number, tEnd: number, sd: 1 | -1, S: number) {
  const rows = 10;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const bx = sd * C45;
  const px = -sd * C45;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= S; j++) {
      const [m, X, nm, nX] = kit.point(j / S, rho);
      const t0 = Math.max(-X * T22, X);
      const t = t0 + ((tEnd - t0) * i) / rows;
      pos.push(bx * t + px * X, C45 * t + C45 * X, m);
      nor.push(px * nX, C45 * nX, nm);
      uv.push(j / S, (11 + tEnd - t) / TEX_LENGTH);
    }
  }
  return orientedGrid(pos, nor, uv, rows + 1, S + 1);
}
/** Inlet along Y, from yBot up to the two mitres y = -|x| tan 22.5° (the pentagon's top edges); major along X, minor along Z. */
function owyeInletGeo(kit: Kit, rho: number, yBot: number, S: number) {
  const rows = 8;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= S; j++) {
      const [m, X, nm, nX] = kit.point(j / S, rho);
      const yTop = -Math.abs(X) * T22;
      const y = yBot + ((yTop - yBot) * i) / rows;
      pos.push(X, y, m);
      nor.push(nX, 0, nm);
      uv.push(j / S, (y + 40) / TEX_LENGTH);
    }
  }
  return orientedGrid(pos, nor, uv, rows + 1, S + 1);
}
/** Y45 / RY45. ends: [inlet A, left leg B, right leg C], each with its kit (the connection goes on all three, as the round wyes). */
function buildOvalWye(type: OvalWyeType, main: OvalSz, b: OvalSz, c: OvalSz, mats: Mats, style: EndStyle) {
  const { metal, inside, seam } = mats;
  const km = ovalKit(main.A, main.a);
  const d = ovalWyeDims(type, main, b, c);
  const group = new THREE.Group();
  const segs = (k: Kit) => 2 * Math.round(Math.min(220, 96 + Math.round(k.perimeter(k.R0) * 1.2)) / 2);
  const ribOf = (k: Kit) => Math.min(0.34, 0.04 + k.eqD * 0.012);
  const S = segs(km);
  const rib = ribOf(km);
  const half = main.A / 2;
  const yBot = -(half * T22 + OWYE_STRAIGHT);
  group.add(new THREE.Mesh(owyeInletGeo(km, km.R0, yBot, S), metal));
  group.add(new THREE.Mesh(owyeInletGeo(km, km.R0 - km.wall, yBot, S), inside));
  const tEnd = d.reach;
  const kr = km.R0 + rib * 0.35; // seams a little proud of the surface
  const seamTube = (f: (u: number, v: THREE.Vector3) => THREE.Vector3) => new THREE.Mesh(new THREE.TubeGeometry(new FnCurve(f), S, rib * 0.8, 8, false), seam);
  // centre seam on x = 0: the crotch half (X >= 0) of the section, at y = √2 X
  group.add(seamTube((u, v) => {
    const [m, X] = km.point(u * 0.5, kr);
    return v.set(0, Math.SQRT2 * X, m);
  }));
  const X_ = new THREE.Vector3(1, 0, 0);
  const inlet = teeEndFrame(new THREE.Vector3(0, yBot - COLLAR, 0), new THREE.Vector3(0, -1, 0), X_.clone());
  inlet.add(buildCollar(km, style, mats, rib * 0.8, S));
  group.add(inlet);
  const ends: THREE.Group[] = [inlet];
  const kits: Kit[] = [km];
  ([
    [-1, d.B, d.RB],
    [1, d.C, d.RC],
  ] as const).forEach(([sd, sz, Rr]) => {
    group.add(new THREE.Mesh(owyeLegGeo(km, km.R0, tEnd, sd, S), metal));
    group.add(new THREE.Mesh(owyeLegGeo(km, km.R0 - km.wall, tEnd, sd, S), inside));
    // mitre seam with the inlet, round the leg's outer half (X <= 0)
    group.add(seamTube((u, v) => {
      const [m, X] = km.point(0.5 + u * 0.5, kr);
      const t = -X * T22;
      return v.set(sd * C45 * (t - X), C45 * (t + X), m);
    }));
    const axis = new THREE.Vector3(sd * C45, C45, 0);
    const p = new THREE.Vector3(-sd * C45, C45, 0);
    const f = teeEndFrame(axis.clone().multiplyScalar(tEnd + Rr + COLLAR), axis.clone(), p);
    const ko = Rr > 0 ? ovalKit(sz.A, sz.a) : km;
    if (Rr > 0) {
      const x0 = -COLLAR - Rr;
      const x1 = -COLLAR;
      f.add(new THREE.Mesh(redTransGeo(km, km.R0, ko, ko.R0, x0, x1, 0, 256), metal));
      f.add(new THREE.Mesh(redTransGeo(km, km.R0 - km.wall, ko, ko.R0 - ko.wall, x0, x1, 0, 256), inside));
      f.add(new THREE.Mesh(new THREE.TubeGeometry(new km.Loop(km.R0 + rib * 0.2, x0), S, rib * 0.8, 8, true), seam));
      f.add(new THREE.Mesh(new THREE.TubeGeometry(new ko.Loop(ko.R0 + ribOf(ko) * 0.2, x1), segs(ko), ribOf(ko) * 0.8, 8, true), seam));
    }
    f.add(buildCollar(ko, style, mats, ribOf(ko) * 0.8, segs(ko)));
    group.add(f);
    ends.push(f);
    kits.push(ko);
  });
  return { group, ends, kits };
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


/**
 * Couplings & ends (sheet 9 "Pipe Coupling and Fitting Coupling, End Cap, Start Collar, End Cap/Plug, Bellmouth"), the
 * round sheet 10 card adapted to oval: one model with a type picker and one size A x α. Each part is shown with what it
 * goes on, see-through (reference only), pulled apart; Play puts it together and drives the screws.
 *   PC   pipe coupling: a 2" oval band inside both pipe ends (pipe ends are female), raised centre bead as the stop
 *        (the sheet's solid centre line), crimped ends.
 *   FC   fitting coupling: a plain 2" oval sleeve OVER two fitting ends (fitting ends are male), a ring of pressed-in
 *        dimples at its centre as the stop (the sheet's dashed centre line), as the round FC.
 *   OEC  oval end cap: a flat oval disc A x α, rolled rim, a 1" skirt (the round EC's, assumed) into the pipe end.
 *   OF   oval flange: drawn as the round start collar (assumed: the title lists Start Collar, the sheet draws OF):
 *        a 2" oval collar A x α with a 1" flange all round, screwed to a duct / plenum wall over the hole.
 *   BM   bell mouth: ordered by A; 3" high: the collar A x α on top (crimped, the duct slides over it to the bead),
 *        a 2" radius flare out to B x b at the bottom, B = A + 4" (sheet), b = α + 4" (assumed), rolled edge.
 */
export const OVAL_CAPS: Record<OvalCapType, { code: string; name: string; short: string }> = {
  pc: { code: "PC", name: "Pipe Coupling", short: "pipe" },
  fc: { code: "FC", name: "Fitting Coupling", short: "fitting" },
  oec: { code: "OEC", name: "Oval End Cap", short: "cap" },
  of: { code: "OF", name: "Oval Flange", short: "flange" },
  bm: { code: "BM", name: "Bell Mouth", short: "bell" },
};
const OCAP_LEN = 2; // PC / FC band, OF collar (sheet)
const OCAP_FLANGE = 1; // OF flange past the collar (sheet's 1")
const OEC_SKIRT = 1; // assumed, the round EC's
const OBM_H = 3;
const OBM_FLARE = 2; // each side: B = A + 4 (sheet), b = α + 4 (assumed)
export function ovalCapDims(type: OvalCapType, main: OvalSz) {
  return { type, B: main.A + 2 * OBM_FLARE, b: main.a + 2 * OBM_FLARE, fA: main.A + 2 * OCAP_FLANGE, fa: main.a + 2 * OCAP_FLANGE };
}
/** Screws round the oval at radius rho, one row per x, driven one after another. */
function ovalRingScrews(kit: Kit, rho: number, xs: number[], mat: THREE.Material): Joint["screws"] {
  const n = screwCount(kit.eqD);
  const k = screwScale(kit.eqD);
  const group = new THREE.Group();
  const items: Joint["screws"]["items"] = [];
  const win = 1 / xs.length;
  const each = win * 0.55;
  xs.forEach((x, side) => {
    for (let i = 0; i < n; i++) {
      const [y, z, ny, nz] = kit.point((i + 0.25 + side * 0.5) / n, rho);
      const obj = new THREE.Group();
      obj.position.set(x, y, z);
      obj.rotation.x = Math.atan2(nz, ny);
      const s = screwMesh(k, mat);
      obj.add(s.obj);
      group.add(obj);
      const start = side * win + (i / Math.max(1, n - 1)) * (win - each);
      items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
    }
  });
  return { group, items };
}
/** A fitting's end, see-through: a short straight body and its 2" beaded collar, open end at x = 0, +X out. */
function ghostOvalFittingEnd(kit: Kit, ref: Mats, S: number, len = 4.5) {
  const g = new THREE.Group();
  const uv = 1 / TEX_LENGTH;
  g.add(new THREE.Mesh(kit.shell([-len, -COLLAR], S, () => kit.R0, uv), ref.metal));
  g.add(new THREE.Mesh(kit.shell([-len, -COLLAR], S, () => kit.R0 - kit.wall, uv), ref.inside));
  g.add(buildCollar(kit, "bead", ref, Math.min(0.34, 0.04 + kit.eqD * 0.012) * 0.8, S));
  return g;
}
/** One sheet 9 part with what it goes on (see-through), along X; OF and BM are turned to stand up (+X -> up). */
function buildOvalCap(type: OvalCapType, kit: Kit, sheet: THREE.Material, ref: Mats, seam: THREE.Material, screwMat: THREE.Material) {
  const r = kit.R0;
  const wall = kit.wall;
  const S = 2 * Math.round(Math.min(220, 96 + Math.round(kit.perimeter(r) * 1.2)) / 2);
  const uv = 1 / TEX_LENGTH;
  const group = new THREE.Group();
  const gap = kit.eqD <= 8 ? 1.5 : kit.eqD <= 16 ? 2 : 2.5;
  const PIPE = 5; // see-through duct pieces (short, so the part fills the view)
  let moving: Joint["moving"] = [];
  let screws: Joint["screws"] = { group: new THREE.Group(), items: [] };
  const pipe = () => buildOvalPipe(kit, ref, PIPE);
  if (type === "pc") {
    // Band inside both pipe ends: crimped (fluted) ends, raised centre bead (the stop). Pipe | gap | band | gap | pipe.
    const rc = r - wall - 0.03;
    const bw = 0.5;
    const bh = r + 0.14 - rc;
    const cl = 0.45;
    const flutes = Math.max(24, Math.round(kit.perimeter(rc) / 0.42));
    const cd = 0.1 + kit.eqD * 0.003;
    const C = OCAP_LEN;
    const xs = samples(-C / 2, C / 2, (x) => Math.abs(x) < bw / 2 + 0.1 || C / 2 - Math.abs(x) < cl + 0.05);
    const rho = (x: number, u: number) => {
      let rr = rc;
      if (Math.abs(x) < bw / 2) rr += bh * 0.5 * (1 + Math.cos((Math.PI * x) / (bw / 2)));
      const e = C / 2 - Math.abs(x);
      if (e < cl) rr -= cd * Math.pow(1 - e / cl, 0.8) * 0.5 * (1 - Math.cos(flutes * u * Math.PI * 2));
      return rr;
    };
    const band = new THREE.Group();
    band.add(new THREE.Mesh(kit.shell(xs, flutes * 4, rho, uv, rc), sheet));
    band.position.x = gap + C / 2;
    const p0 = pipe();
    p0.position.x = -PIPE / 2;
    const p1 = pipe();
    const p1Start = gap + C + gap;
    p1.position.x = p1Start + PIPE / 2;
    group.add(band, p0, p1);
    moving = [
      { obj: band, from: 0, to: bw / 2 - (gap + C / 2) },
      { obj: p1, from: 0, to: bw - p1Start },
    ];
    screws = ovalRingScrews(kit, r, [-0.5, bw + 0.5], screwMat);
  } else if (type === "fc") {
    // Plain sleeve over both fitting ends, centre dimples (the stop) read as a dashed ring; hemmed edges.
    const ri = r + 0.05;
    const ro = ri + wall;
    const nd = Math.max(10, Math.round(kit.perimeter(ro) / 1.1));
    const dw = 0.14;
    const depth = 0.07 + kit.eqD * 0.002;
    const xs = samples(-OCAP_LEN / 2, OCAP_LEN / 2, (x) => Math.abs(x) < dw + 0.05, 0.025, 0.25);
    const dent = (x: number, u: number) => {
      if (Math.abs(x) >= dw) return 0;
      const p = 0.5 * (1 + Math.cos(nd * u * Math.PI * 2));
      const dash = Math.min(1, Math.max(0, (p - 0.35) / 0.3));
      return depth * 0.5 * (1 + Math.cos((Math.PI * x) / dw)) * dash * dash * (3 - 2 * dash);
    };
    const sleeve = new THREE.Group();
    sleeve.add(new THREE.Mesh(kit.shell(xs, Math.min(900, nd * 14), (x, u) => ro - dent(x, u), uv, ro), sheet));
    for (const x of [-OCAP_LEN / 2, OCAP_LEN / 2]) sleeve.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(ro - wall / 2, x), S, Math.max(0.045, wall * 0.9), 6, true), sheet));
    group.add(sleeve);
    const stop = 0.06;
    const fL = ghostOvalFittingEnd(kit, ref, S);
    fL.position.x = -OCAP_LEN / 2 - gap;
    const fR = ghostOvalFittingEnd(kit, ref, S);
    fR.rotation.y = Math.PI;
    fR.position.x = OCAP_LEN / 2 + gap;
    group.add(fL, fR);
    moving = [
      { obj: fL, from: 0, to: OCAP_LEN / 2 + gap - stop },
      { obj: fR, from: 0, to: -(OCAP_LEN / 2 + gap - stop) },
    ];
    screws = ovalRingScrews(kit, ro, [-OCAP_LEN / 4 - stop / 2, OCAP_LEN / 4 + stop / 2], screwMat);
  } else if (type === "oec") {
    // Oval disc A x α (rolled rim) facing +X, skirt -1..0 slipping into the pipe end (pipe ends at x = 0).
    const rs = r - wall - 0.03;
    const cap = new THREE.Group();
    const face = new THREE.ShapeGeometry(new THREE.Shape(kit.outline(r + 0.02, S)), 1);
    face.rotateY(Math.PI / 2);
    const fuv = face.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) / TEX_LENGTH, fuv.getY(i) / TEX_LENGTH);
    cap.add(new THREE.Mesh(face, sheet));
    cap.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(r + 0.02, 0), S, Math.max(0.07, kit.eqD * 0.006), 8, true), sheet));
    cap.add(new THREE.Mesh(kit.shell([-OEC_SKIRT, -0.05], S, () => rs, uv, rs), sheet));
    // A shallow stiffening bead pressed in the face, inset all round.
    cap.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(r * 0.62, 0.01), S, Math.min(0.12, 0.04 + kit.eqD * 0.004), 8, true), sheet));
    cap.position.x = gap + OEC_SKIRT;
    const p = pipe();
    p.position.x = -PIPE / 2;
    group.add(cap, p);
    moving = [{ obj: cap, from: 0, to: -(gap + OEC_SKIRT) }];
    screws = ovalRingScrews(kit, r, [-OEC_SKIRT / 2], screwMat);
  } else if (type === "of") {
    // Wall (see-through) in the YZ plane at x = 0 with the oval hole; collar + 1" flange on its +X face, pulled off.
    const t = 0.075;
    const wA = kit.A + 6;
    const wa = kit.minor + 6;
    const wallShape = new THREE.Shape([new THREE.Vector2(-wA / 2, -wa / 2), new THREE.Vector2(wA / 2, -wa / 2), new THREE.Vector2(wA / 2, wa / 2), new THREE.Vector2(-wA / 2, wa / 2)]);
    wallShape.holes.push(new THREE.Path(kit.outline(r, S).reverse()));
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 0.06, bevelEnabled: false, curveSegments: 1 });
    wallGeo.rotateY(Math.PI / 2);
    wallGeo.translate(-0.06, 0, 0);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wallGeo, 30), new THREE.LineBasicMaterial({ color: 0x8e9bab, transparent: true, opacity: 0.55 }));
    group.add(new THREE.Mesh(wallGeo, ref.metal), edges);
    const col = new THREE.Group();
    col.add(new THREE.Mesh(kit.ring(r + OCAP_FLANGE, r - 0.01, t, S, uv), sheet));
    col.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(r + OCAP_FLANGE, t / 2), S, 0.07, 8, true), sheet));
    col.add(new THREE.Mesh(kit.shell([0, OCAP_LEN], S, () => r, uv), sheet));
    col.add(new THREE.Mesh(kit.rim(r + 0.005, r - wall, OCAP_LEN, S), sheet));
    col.position.x = gap;
    group.add(col);
    moving = [{ obj: col, from: 0, to: -gap }];
    // Screws through the flange into the wall, parallel to the collar (heads on the flange, facing +X).
    const n = screwCount(kit.eqD);
    const k = screwScale(kit.eqD);
    const sg = new THREE.Group();
    const items: Joint["screws"]["items"] = [];
    const each = 0.4;
    for (let i = 0; i < n; i++) {
      const [y, z] = kit.point((i + 0.5) / n, r + OCAP_FLANGE / 2);
      const obj = new THREE.Group();
      obj.position.set(t, y, z);
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
    // Bell mouth along +X (up): flare x 0..2 from B x b to A x α (quarter circle, radius 2), bead, crimped collar 2..3.
    const flare = (x: number) => r + OBM_FLARE - Math.sqrt(Math.max(0, OBM_FLARE * OBM_FLARE - (x - OBM_FLARE) * (x - OBM_FLARE)));
    const fx: number[] = [];
    for (let i = 0; i <= 28; i++) fx.push(OBM_FLARE - OBM_FLARE * Math.sin((i / 28) * (Math.PI / 2)));
    fx.reverse();
    const bm = new THREE.Group();
    bm.add(new THREE.Mesh(kit.shell(fx, S, (x) => flare(x), uv), sheet));
    const rcr = r - wall - 0.05;
    const flutes = Math.max(24, Math.round(kit.perimeter(rcr) / 0.42));
    const cd = 0.1 + kit.eqD * 0.003;
    const c0 = OBM_FLARE + 0.3;
    const crad = (x: number, u: number) => {
      if (x < c0) return r;
      const e = Math.min(1, (x - c0) / CRIMP_TAPER);
      const k = e * e * (3 - 2 * e);
      return r - (r - rcr) * k - cd * k * 0.5 * (1 - Math.cos(flutes * u * Math.PI * 2));
    };
    const cx = samples(OBM_FLARE, OBM_H, (x) => x > c0 - 0.05, 0.05, 0.3);
    bm.add(new THREE.Mesh(kit.shell(cx, flutes * 4, crad, uv), sheet));
    const bead = Math.min(0.34, 0.04 + kit.eqD * 0.012) * 0.8;
    bm.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(r + 0.04, OBM_FLARE + 0.12), S, bead, 8, true), seam));
    bm.add(new THREE.Mesh(new THREE.TubeGeometry(new kit.Loop(r + OBM_FLARE, 0.06), Math.min(240, S + 24), 0.12, 8, true), sheet));
    group.add(bm);
    // Duct above, pulled off; Play slides it down over the collar up to the bead.
    const stopX = OBM_FLARE + 0.3;
    const duct = pipe();
    duct.position.x = OBM_H + gap + PIPE / 2;
    group.add(duct);
    moving = [{ obj: duct, from: 0, to: stopX - (OBM_H + gap) }];
    screws = ovalRingScrews(kit, r, [(stopX + OBM_H) / 2 + 0.1], screwMat);
    group.rotation.z = Math.PI / 2;
  }
  group.add(screws.group);
  return { group, moving, screws };
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

/** Wye connections: on all three ends at once, as the round Y45 / RY45 (RY45's legs: the small B / C ends, past their reducers). */
const OWYE_CONNECTION_TEXT: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Coupling (slip joint)",
    text: "On all three ends (RY45 legs: the small B / C end), as the round wyes: each is crimped past the bead, the oval duct slides over the crimp up to the bead and is screwed on. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "On all three ends (RY45 legs: the small B / C end), as the round wyes: straight ends, no beads. A flange goes in each end; gasket and screws join it to the duct's flange. Shown pulled apart.",
  },
};

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

type Model = { type: OvalElbowType; bend: OvalBend; A: number; minor: number; teeType: OvalAnyTee; redType: OvalRedType; wyeType: OvalWyeType; capType: OvalCapType; out: OvalSz; top: OvalSz; bottom: OvalSz | null };
export type OvalElbowKind = "gored" | "miter" | "tee" | "ctee" | "lltee" | "lat" | "red" | "wye" | "cap";
const szKey = (s: OvalSz) => `${s.A}x${s.a}`;
const szText = (s: OvalSz) => `${s.A}×${s.a}`;
/** Chart sizes up to max (both axes; the outlet's A strictly smaller), largest first. */
const sizesWithin = (max: OvalSz, smallerA = false) =>
  OVAL_SIZES.filter((s) => (smallerA ? s.A < max.A : s.A <= max.A) && s.a <= max.a)
    .map((s) => ({ A: s.A, a: s.a }))
    .sort((p, q) => q.A - p.A || q.a - p.a);
/** The wanted size if it is in the list, else the nearest one. */
const snapSz = (want: OvalSz, list: OvalSz[]) =>
  list.find((s) => s.A === want.A && s.a === want.a) ?? list.reduce((b, s) => (Math.abs(s.A - want.A) + Math.abs(s.a - want.a) < Math.abs(b.A - want.A) + Math.abs(b.a - want.a) ? s : b), list[0]);
const MITER_NAME = "90° 2-Piece Mitered Elbow";
const miterCode = (hard: boolean) => `02PV90 ${hard ? "H" : "E"}`;

export default function OvalElbow3D({
  kind = "gored",
  type: type0,
  bend: bend0,
  teeType: teeType0 = "0t90",
  redType: redType0 = "cr",
  wyeType: wyeType0 = "y45",
  capType: capType0 = "pc",
  onClose,
}: {
  kind?: OvalElbowKind;
  type: OvalElbowType;
  bend: OvalBend;
  teeType?: OvalAnyTee;
  redType?: OvalRedType;
  wyeType?: OvalWyeType;
  capType?: OvalCapType;
  onClose: () => void;
}) {
  const miter = kind === "miter";
  const ctee = kind === "ctee";
  const lltee = kind === "lltee";
  const olat = kind === "lat";
  const ocap = kind === "cap"; // couplings & ends: their own build with see-through duct / fittings / wall, Play puts the part on, no connection
  const owye = kind === "wye"; // wyes: their own build, inlet A x α and RY45's B / C pickers, connections on all three ends
  const ored = kind === "red"; // reducers: their own build, the tees' outlet picker and connection on the outlet
  const tee = kind === "tee" || ctee || lltee || olat; // the conical, low-loss and lateral ones are the same fitting with other branches
  const teeTypes: readonly OvalAnyTee[] = olat ? OVAL_LAT_TYPES : lltee ? OVAL_LLTEE_TYPES : ctee ? OVAL_CTEE_TYPES : OVAL_TEE_TYPES;
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
  const [teeType, setTeeType] = useState<OvalAnyTee>(teeType0);
  // wanted branch / outlet sizes (snapped to what fits the main below)
  const [wantOut, setWantOut] = useState<OvalSz>(OVAL_TEES[teeType0].defaults.out ?? { A: 19, a: 10 });
  const [wantTop, setWantTop] = useState<OvalSz>(OVAL_TEES[teeType0].defaults.top);
  const [wantBottom, setWantBottom] = useState<OvalSz>(OVAL_TEES[teeType0].defaults.bottom ?? { A: 14, a: 8 });
  const [redType, setRedType] = useState<OvalRedType>(redType0);
  const [wantRedOut, setWantRedOut] = useState<OvalSz>({ A: 21, a: 12 });
  const [wyeType, setWyeType] = useState<OvalWyeType>(wyeType0);
  const [wantWyeB, setWantWyeB] = useState<OvalSz>({ A: 21, a: 12 });
  const [wantWyeC, setWantWyeC] = useState<OvalSz>({ A: 18, a: 10 });
  const [capType, setCapType] = useState<OvalCapType>(capType0);
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
    // Mitered elbow (vanes): its walls go see-through so the vanes inside read, as the round MEV90 (connections stay solid).
    const ghost = (m: THREE.MeshStandardMaterial, opacity: number) => {
      const g = m.clone();
      g.transparent = true;
      g.opacity = opacity;
      g.depthWrite = false;
      return g;
    };
    const ghostMats: Mats = { metal: ghost(metal, 0.28), inside: ghost(inside, 0.16), seam: ghost(seam, 0.85) };
    // Couplings & ends: what the part goes on (duct, fitting ends, wall) is reference only, more see-through (as the round sheet 10 card).
    const refMats: Mats = { metal: ghost(metal, 0.16), inside: ghost(inside, 0.08), seam: ghost(seam, 0.22) };
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, map: spangle, metalness: 0.5, roughness: 0.42, envMapIntensity: 1, side: THREE.DoubleSide });
    const vaneEdge = new THREE.MeshStandardMaterial({ color: 0x5f6b77, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8 });

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
    // Mitered: more from the side (looking into the outlet a little), so the vane faces show, as the round MEV90.
    // Tees: from the front a little above and to the right, so the oval main, its flat and the branches read.
    // Low-loss: from the front (the flat side), a little to the left and above, so the inlet-side sweep reads as on the sheet.
    // Laterals: from the front, a little to the right and above, so the 45° branches read as on the sheet.
    // Reducers: from the side (the round end), a little to the right and above, so the ER's straight top reads as drawn.
    // Wyes: from the front (a flat side), a little to the right and above, so the pentagon and the 45° legs read as drawn.
    let view = owye ? new THREE.Vector3(0.28, 0.32, 1) : ored ? new THREE.Vector3(0.22, 0.3, 1) : miter ? new THREE.Vector3(0.85, 0.42, -1) : olat ? new THREE.Vector3(0.3, 0.45, 1) : lltee ? new THREE.Vector3(-0.3, 0.5, 1) : tee ? new THREE.Vector3(1, 0.6, 0.7) : new THREE.Vector3(0.3, 0.32, 1);
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

    let current: Model | null = null;
    let currentC: Connection = "none";
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      if (!current) return;
      const { type, bend, A, minor } = current;
      const hard = bend === "hard";
      const style: EndStyle = currentC === "coupling" ? "crimp" : currentC === "flange" ? "plain" : "bead";
      let kit = ovalKit(A, minor);
      if (ocap) {
        // Sheet 9 parts: built with their see-through duct / fittings / wall and their own Play motion; no connection.
        const t = current.capType;
        view = t === "of" ? new THREE.Vector3(0.35, 0.6, 1) : t === "bm" ? new THREE.Vector3(0.3, 0.38, 1) : t === "oec" ? new THREE.Vector3(0.75, 0.32, 1) : new THREE.Vector3(0.3, 0.32, 1);
        const part = buildOvalCap(t, kit, sheet, refMats, seam, screwMat);
        moving = part.moving.map((m) => ({ ...m, base: m.obj.position.x }));
        screws = part.screws.items;
        stopPlay();
        part.group.updateMatrixWorld(true);
        part.group.position.sub(new THREE.Box3().setFromObject(part.group).getCenter(new THREE.Vector3()));
        model = new THREE.Group();
        model.add(part.group);
        scene.add(model);
        spangle.repeat.set(Math.max(2, Math.round(kit.perimeter(kit.R0) / 10)), TEX_LENGTH / 10);
        scale = A;
        renderer.domElement.setAttribute("aria-label", `3D ${OVAL_CAPS[t].code} ${OVAL_CAPS[t].name.toLowerCase().replace(/^(?!oval)/, "oval ")}, ${A} by ${minor} inches, shown with what it goes on, see-through. Drag to turn, pinch to zoom.`);
        frame();
        return;
      }
      let built: { group: THREE.Group; ends: THREE.Group[] };
      let endKits: Kit[] | null = null;
      if (owye) {
        const w = buildOvalWye(current.wyeType, { A, a: minor }, current.out, current.top, mats, style);
        built = w;
        endKits = w.kits;
      } else if (ored) {
        const r = buildOvalReducer(current.redType, { A, a: minor }, current.out, mats, style);
        built = r;
        kit = r.connKit; // the connection goes on the outlet (B) end
      } else if (tee) {
        const t = buildOvalTee(current.teeType, { A, a: minor }, current.out, current.top, current.bottom, mats, style);
        built = t;
        kit = t.connKit; // the connection goes on the outlet
      } else {
        built = miter ? buildOvalMiter(kit, hard, ghostMats, style, ovalVanes(hard ? A : minor).n, vaneMat, vaneEdge) : buildOvalElbow(kit, type, hard, mats, style);
      }
      const { group: elbow, ends } = built;
      // Connection on the bottom end (the duct hangs straight down under the elbow), same as the round elbows; tees: the outlet.
      // Wyes: on all three ends at once, each its own size (as the round wyes).
      const jointOn = (k: Kit, f: THREE.Group) => (currentC === "coupling" ? slipJoint(k, f, mats, screwMat) : currentC === "flange" ? flangeJoint(k, f, mats, metal, sheet, gasketMat, screwMat) : null);
      const joints = (endKits ? ends.map((f, i) => jointOn(endKits![i], f)) : [jointOn(kit, ends[0])]).filter((j): j is Joint => !!j);
      moving = joints.flatMap((j) => j.moving.map((m) => ({ ...m, base: m.obj.position.x })));
      screws = joints.flatMap((j) => j.screws.items);
      stopPlay();
      // Bottom end on the left, the other end out to the right, as drawn on the sheet (the miter is built that way round).
      if (!miter && !tee && !ored && !owye) elbow.rotation.y = Math.PI;
      elbow.updateMatrixWorld(true);
      elbow.position.sub(new THREE.Box3().setFromObject(elbow).getCenter(new THREE.Vector3()));
      model = new THREE.Group();
      model.add(elbow);
      scene.add(model);
      spangle.repeat.set(Math.max(2, Math.round(kit.perimeter(kit.R0) / 10)), TEX_LENGTH / 10);
      scale = A;
      renderer.domElement.setAttribute(
        "aria-label",
        owye
          ? `3D ${OVAL_WYES[current.wyeType].code} oval ${OVAL_WYES[current.wyeType].name.toLowerCase()}, inlet ${A} by ${minor} inches${current.wyeType === "ry45" ? `, legs ${current.out.A} by ${current.out.a} and ${current.top.A} by ${current.top.a}` : ""}. Drag to turn, pinch to zoom.`
          : ored
          ? `3D ${OVAL_REDS[current.redType].code} oval ${OVAL_REDS[current.redType].name.toLowerCase()}, ${A} by ${minor} to ${current.out.A} by ${current.out.a} inches. Drag to turn, pinch to zoom.`
          : tee
          ? `3D ${OVAL_TEES[current.teeType].code} oval ${OVAL_TEES[current.teeType].name.toLowerCase()}, main ${A} by ${minor} inches. Drag to turn, pinch to zoom.`
          : `3D ${miter ? `${miterCode(hard)} oval mitered elbow with vanes` : `${OVAL_ELBOWS[type].code} oval elbow`}, ${A} by ${minor} inches, ${hard ? "hard" : "easy"} bend. Drag to turn, pinch to zoom.`,
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
    const ro = new ResizeObserver(() => {
      resize();
      frame();
    });
    ro.observe(el);

    api.current = {
      setModel: (m) => {
        if (current && JSON.stringify(m) === JSON.stringify(current)) return;
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
      [metal, seam, inside, sheet, screwMat, gasketMat, ...Object.values(ghostMats), ...Object.values(refMats), vaneMat, vaneEdge].forEach((m) => m.dispose());
      [spangle, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  // Tees: the outlet, top and bottom branch sizes that fit (outlet smaller than the main; a branch's minor b up to the
  // main's α so it fits the rounded edge in a clean saddle, its major B up to the main's A; the bottom branch up to the top one: the sheet's B > C / C > D, equal allowed as on the round conical crosses).
  const teeSpec = OVAL_TEES[teeType];
  const main: OvalSz = { A, a: minor };
  const outList = sizesWithin(main, true);
  const out = teeSpec.reducing && outList.length ? snapSz(wantOut, outList) : main;
  const topList = sizesWithin(main);
  const top = snapSz(wantTop, topList);
  const bottomList = sizesWithin(top);
  const bottom = teeSpec.cross ? snapSz(wantBottom, bottomList) : null;
  const redOutList = redOutsFor(main);
  const redOut = redOutList.length ? snapSz(wantRedOut, redOutList) : main;
  // RY45 legs: B and C each up to A x α, at least one axis smaller (the reducer card's outlets); may differ.
  const wyeB = redOutList.length ? snapSz(wantWyeB, redOutList) : main;
  const wyeC = redOutList.length ? snapSz(wantWyeC, redOutList) : main;
  const modelKey = ocap ? capType : owye ? `${wyeType}|${szKey(wyeB)}|${szKey(wyeC)}` : ored ? `${redType}|${szKey(redOut)}` : tee ? `${teeType}|${szKey(out)}|${szKey(top)}|${bottom ? szKey(bottom) : ""}` : "";
  useEffect(() => {
    api.current?.setModel({ type, bend, A, minor, teeType, redType, wyeType, capType, out: ored ? redOut : owye ? wyeB : out, top: owye ? wyeC : top, bottom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, bend, A, minor, modelKey]);
  useEffect(() => {
    api.current?.setConnection(connection);
  }, [connection]);
  // Keep the link in step with the type and bend shown (replace, so Back still closes the model).
  useEffect(() => {
    const [prefix, hash] = ocap
      ? [SWFO_CAP_3D_HASH, ovalCapHash(capType)]
      : owye
      ? [SWFO_WYE_3D_HASH, ovalWyeHash(wyeType)]
      : ored
      ? [SWFO_RED_3D_HASH, ovalRedHash(redType)]
      : olat
      ? [SWFO_LAT_3D_HASH, ovalLatHash(teeType as OvalLatType)]
      : lltee
      ? [SWFO_LLTEE_3D_HASH, ovalLlteeHash(teeType as OvalLlteeType)]
      : ctee
      ? [SWFO_CTEE_3D_HASH, ovalCteeHash(teeType as OvalCteeType)]
      : tee
        ? [SWFO_TEE_3D_HASH, ovalTeeHash(teeType as OvalTeeType)] : miter ? [SWFO_MITER_3D_HASH, ovalMiterHash(bend)] : [SWFO_ELBOW_3D_HASH, ovalElbowHash(type, bend)];
    if (location.hash.startsWith(prefix)) history.replaceState(history.state, "", location.pathname + location.search + hash);
  }, [type, bend, miter, tee, ctee, lltee, olat, ored, owye, ocap, teeType, redType, wyeType, capType]);
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

  // reducers and RY45: only inlets with a smaller outlet in the chart
  const needOut = ored || (owye && wyeType === "ry45");
  const minors = needOut ? ovalMinorsFor(A).filter((m) => redOutsFor({ A, a: m }).length) : ovalMinorsFor(A);
  // the R types need an outlet smaller than the main, so not the smallest major
  const majors = needOut
    ? OVAL_MAJORS.filter((d) => ovalMinorsFor(d).some((m) => redOutsFor({ A: d, a: m }).length))
    : tee && teeSpec.reducing ? OVAL_MAJORS.filter((d) => d > OVAL_MAJORS[0]) : OVAL_MAJORS;
  const pickTeeType = (t: OvalAnyTee) => {
    setTeeType(t);
    const d = OVAL_TEES[t].defaults;
    if (d.out) setWantOut(d.out);
    setWantTop(d.top);
    if (d.bottom) setWantBottom(d.bottom);
    if (OVAL_TEES[t].reducing && A <= OVAL_MAJORS[0]) pickA(OVAL_MAJORS[1]);
  };
  const { L: teeL, R: teeR } = ovalTeeDims(teeType, main, out, top);
  const size = ovalSize(A, minor);
  const pickA = (next: number) => {
    setA(next);
    const ms = needOut ? ovalMinorsFor(next).filter((m) => redOutsFor({ A: next, a: m }).length) : ovalMinorsFor(next);
    if (!ms.includes(minor)) setMinor(ms.reduce((best, m) => (Math.abs(m - minor) < Math.abs(best - minor) ? m : best), ms[0]));
  };
  const pickWyeType = (t: OvalWyeType) => {
    setWyeType(t);
    // RY45 needs an inlet with a smaller leg size (the smallest sizes have none): back to the default inlet
    if (t === "ry45" && !redOutsFor(main).length) {
      setA(DEFAULT_A);
      setMinor(DEFAULT_MINOR);
    }
  };
  const wd = ovalWyeDims(wyeType, main, wyeB, wyeC);
  const wyeSpec = OVAL_WYES[wyeType];
  const legR = (r: ReturnType<typeof ovalRedDims> | null, leg: string, sz: OvalSz) =>
    r ? `${leg} × ${leg.toLowerCase()} (${szText(sz)}) R = ${inches(r.R)}″ (${r.byMinor ? `α − ${leg.toLowerCase()} = ${r.red}″, more than the major's, assumed` : `A − ${leg} = ${r.red}″`}${r.past ? ", past the table, +4″ steps, assumed" : ""})` : "";
  const wyeText =
    wyeType === "y45"
      ? `Inlet A × α (${szText(main)}) at the bottom, splitting into two A × α legs at 45° each side (90° apart), split across the major A (assumed). As the round Y45 (the sheet gives no leg length, assumed): 2″ straight past the crotch, each leg ${inches(wd.reach)}″ from the junction to its 2″ collar.`
      : `Inlet A × α (${szText(main)}), left leg to ${legR(wd.rB, "B", wyeB)} and right leg to ${legR(wd.rC, "C", wyeC)}, each through a concentric reducer (CR table), then 2″ collars. Legs at 45°, split across the major A (assumed).`;
  const R = 1.5 * (hard ? A : minor);
  const seams = goreSeams(spec.angle, spec.pieces);
  const endGore = seams[1];
  const midGore = spec.pieces > 2 ? seams[2] - seams[1] : 0;
  const goreText =
    spec.pieces > 2
      ? `two ${degs(endGore)} end gores, ${spec.pieces - 2} × ${degs(midGore)} middle`
      : `two ${degs(endGore)} gores`;
  const vanes = ovalVanes(hard ? A : minor);
  const redSpec = OVAL_REDS[redType];
  const rd = ovalRedDims(redType, main, redOut);
  const redBasis = rd.byMinor ? `α − b = ${rd.red}″, more than A − B (assumed)` : `A − B = ${rd.red}″`;
  const redRule =
    redType === "cr"
      ? rd.past
        ? "past the table, +4″ steps, assumed"
        : "table"
      : rd.red <= 3
        ? "table, 1″–3″"
        : `(A − B) × 1.5${rd.byMinor ? " on α − b" : ""}`;
  const redText =
    redType === "cr"
      ? `Oval A × α (${szText(main)}) in on the left to B × b (${szText(redOut)}) out on the right, both on one axis. ${redBasis}, so R = ${inches(rd.R)}″ (${redRule}). 2″ collars, ${inches(rd.L)}″ overall.`
      : `Oval A × α (${szText(main)}) in to B × b (${szText(redOut)}) out, ${rd.dy < 0 ? `bottom flat kept in line (as drawn), outlet ${inches(-rd.dy)}″ lower, top sloped` : "α = b, so both flats stay in line"}. ${redBasis}, so R = ${inches(rd.R)}″ (${redRule}). 2″ collars, ${inches(rd.L)}″ overall.`;
  const capSpec = OVAL_CAPS[capType];
  const cd = ovalCapDims(capType, main);
  const capText: Record<OvalCapType, string> = {
    pc: `Pipe to pipe: a 2″ oval band A × α (${szText(main)}) that slides inside both pipe ends; the raised centre bead (the sheet's solid line) stops each pipe. Crimped ends, screwed. Shown pulled apart.`,
    fc: `Fitting to fitting: a plain 2″ oval sleeve A × α (${szText(main)}) that slides over both fitting ends, stopped by dimples at its centre (the sheet's dashed line), as the round FC. Screwed. Shown pulled apart.`,
    oec: `Closes an open end: a flat oval disc A × α (${szText(main)}) with a rolled rim and a 1″ skirt (the round EC's, assumed) that slips into the duct end, then screwed. Shown pulled apart.`,
    of: `Drawn as the round start collar (assumed): a 2″ oval collar A × α (${szText(main)}) with a 1″ flange all round (${cd.fA}×${cd.fa}), screwed to a duct or plenum wall over the hole. Shown pulled apart.`,
    bm: `Ordered by A. Open intake: 3″ high, the collar A × α (${szText(main)}) on top, a smooth flare out to B × b = ${cd.B}×${cd.b} at the bottom (B = A + 4″; b = α + 4″ assumed). The duct slides over the collar.`,
  };
  const title = ocap ? `${capSpec.name} (${capSpec.code})` : owye ? `${wyeSpec.name} (${wyeSpec.code})` : ored ? `${redSpec.name} (${redSpec.code})` : tee ? `${teeSpec.name} (${teeSpec.code})` : miter ? `${MITER_NAME} (${miterCode(hard)})` : `${spec.name} (${spec.code})`;
  const rNote = teeR > 0 ? `reducer R = ${teeR}″ (${teeR > OVAL_CR_TABLE_MAX ? "past the CR table, assumed" : "CR table"})` : "";
  const cone = "conical oval branch";
  const teeText: Record<OvalAnyTee, string> = {
    "0t90": `Main A × α straight through, oval branch B × b (${szText(top)}) on the rounded side in a saddle, B along the main, b ≤ α. L = B + 3″ = ${teeL}″ between the 2″ collars.`,
    "0rt90": `Main A × α in on the left, ${rNote} down to outlet B × b (${szText(out)}), branch C × c (${szText(top)}) on the rounded side. L = C + 3″ = ${teeL}″, 2″ collars.`,
    "0c180": `Main A × α straight through, branch B × b (${szText(top)}) and C × c (${bottom ? szText(bottom) : ""}) on the two rounded sides, C up to B. L = B + 3″ = ${teeL}″, 2″ collars.`,
    "0rc180": `Main A × α in, ${rNote} to outlet B × b (${szText(out)}), branches C × c (${szText(top)}) and D × d (${bottom ? szText(bottom) : ""}) on the rounded sides, D up to C. L = C + 3″ = ${teeL}″ (sheet: B + 3″).`,
    oct90: `Main A × α straight through, ${cone} B × b (${szText(top)}) on the rounded side in a saddle, a 5″ cone flaring 1″ each side along the main down from its 2″ collar, b ≤ α. L = B + 5″ = ${teeL}″.`,
    orct90: `Main A × α in on the left, ${rNote} down to outlet B × b (${szText(out)}), ${cone} C × c (${szText(top)}) on the rounded side. L = C + 5″ = ${teeL}″, 2″ collars.`,
    occ180: `Main A × α straight through, conical branches B × b (${szText(top)}) and C × c (${bottom ? szText(bottom) : ""}) on the two rounded sides, C up to B. L = B + 5″ = ${teeL}″, 2″ collars.`,
    orcc180: `Main A × α in, ${rNote} to outlet B × b (${szText(out)}), conical branches C × c (${szText(top)}) and D × d (${bottom ? szText(bottom) : ""}) on the rounded sides, D up to C. L = C + 5″ = ${teeL}″.`,
    "ot90-l": `Main A × α straight through, low-loss branch B × b (${szText(top)}) on the rounded side in a saddle: sweeps 3″ upstream (inlet side) and curves up T = 4″ into its 2″ collar, straight on the downstream side; b ≤ α. L = B + 7″ = ${teeL}″.`,
    "ort90-l": `Main A × α in on the left, ${rNote} down to outlet B × b (${szText(out)}), low-loss branch C × c (${szText(top)}) on the rounded side, sweep upstream, T = 4″. L = C + 7″ = ${teeL}″, 2″ collars.`,
    "oc180-l": `Main A × α straight through, low-loss branches B × b (${szText(top)}) and C × c (${bottom ? szText(bottom) : ""}) on the two rounded sides, both swept upstream, T = 4″, C up to B. L = B + 7″ = ${teeL}″, 2″ collars.`,
    "orc180-l": `Main A × α in, ${rNote} to outlet B × b (${szText(out)}), low-loss branches C × c (${szText(top)}) and D × d (${bottom ? szText(bottom) : ""}) on the rounded sides, T = 4″, D up to C. L = C + 7″ = ${teeL}″.`,
    ol45: `Main A × α straight through, oval branch B × b (${szText(top)}) at 45° on the rounded side, leaning to the outlet, in a saddle: 2″ straight, then a 2″ collar; b ≤ α. L = B × 1.414 + 3″ = ${inches(teeL)}″.`,
    orl45: `Main A × α in on the left, ${rNote} down to outlet B × b (${szText(out)}), branch C × c (${szText(top)}) at 45° on the rounded side. L = C × 1.414 + 3″ = ${inches(teeL)}″, 2″ collars.`,
    olc45: `Main A × α straight through, branches B × b (${szText(top)}) and C × c (${bottom ? szText(bottom) : ""}) at 45° on the two rounded sides, leaning to the outlet, C up to B. L = B × 1.414 + 3″ = ${inches(teeL)}″.`,
    orlc45: `Main A × α in, ${rNote} to outlet B × b (${szText(out)}), branches C × c (${szText(top)}) and D × d (${bottom ? szText(bottom) : ""}) at 45° on the rounded sides, D up to C. L = C × 1.414 + 3″ = ${inches(teeL)}″.`,
  };
  const info = ocap
    ? { title, text: capText[capType] }
    : connection !== "none"
      ? owye
        ? OWYE_CONNECTION_TEXT[connection]
        : ored
        ? { title: CONNECTION_TEXT[connection].title, text: `${CONNECTION_TEXT[connection].text.replace(/elbow/g, "outlet")} On the right (outlet, B × b) end.` }
        : tee
        ? { title: CONNECTION_TEXT[connection].title, text: `${CONNECTION_TEXT[connection].text.replace(/elbow/g, "outlet")} On the right (outlet) end.` }
        : CONNECTION_TEXT[connection]
      : owye
        ? { title, text: wyeText }
        : ored
        ? { title, text: redText }
        : tee
        ? { title: `${teeSpec.name} (${teeSpec.code})`, text: teeText[teeType] }
        : miter
        ? {
            title: `${MITER_NAME} w/ Vanes (${miterCode(hard)})`,
            text: `${hard ? "Hard: turns the wide way, A in the bend" : "Easy: turns the flat way, α in the bend"}. Sharp 90° miter, ${vanes.n} turning vane${vanes.n === 1 ? "" : "s"} along the cut (${vanes.range}, assumed). Each leg runs 4″ past the throat, 2″ collar included. Walls shown see-through.`,
          }
        : {
          title: `${spec.name} (${spec.code})`,
          text: `${hard ? "Hard" : "Easy"} bend: turns ${hard ? "the wide way, A in the bend" : "the flat way, α in the bend"}, R = 1.5 × ${hard ? "A" : "α"}. ${spec.pieces} pieces (${goreText}), 2″ straight collars.`,
        };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]" role="dialog" aria-modal="true" aria-label={ocap ? "Oval couplings and ends 3D model" : owye ? "Oval wyes 3D model" : ored ? "Oval reducers 3D model" : olat ? "Oval laterals 3D model" : lltee ? "Oval low-loss tees and crosses 3D model" : ctee ? "Oval conical tees and crosses 3D model" : tee ? "Oval tees and crosses 3D model" : miter ? "Oval mitered elbow 3D model" : "Oval elbows 3D model"}>
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Single Wall Oval · {title}</p>
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
      {ocap ? (
        // Sheet 9 parts are the connection themselves: no Coupling / Flange buttons, just Play to put the part on.
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
                {play === "playing" ? <Pause className="size-4" aria-hidden="true" /> : play === "done" ? <RotateCw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                {play === "playing" ? "Pause" : play === "done" ? "Replay" : "Play"}
              </button>
            )}
          </div>
        </div>
      ) : (
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
      )}
      {ocap && (
        <div className="grid grid-cols-5 gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label="Oval coupling or end type">
          {OVAL_CAP_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={capType === t}
              aria-label={`${OVAL_CAPS[t].name} (${OVAL_CAPS[t].code})`}
              onClick={() => setCapType(t)}
              className="btn-raised btn-raised-sm flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] px-1 font-display text-lg leading-none short:h-9"
            >
              {OVAL_CAPS[t].code}
              <span className="font-sans text-[10px] leading-none font-medium tracking-normal uppercase opacity-75">{OVAL_CAPS[t].short}</span>
            </button>
          ))}
        </div>
      )}
      {tee && (
        <div className="grid grid-cols-4 gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label={olat ? "Oval lateral type" : lltee ? "Oval low-loss tee type" : ctee ? "Oval conical tee type" : "Oval tee type"}>
          {teeTypes.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={teeType === t}
              aria-label={`${OVAL_TEES[t].name} (${OVAL_TEES[t].code})`}
              onClick={() => pickTeeType(t)}
              className="btn-raised btn-raised-sm flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] px-1 font-display text-lg leading-none short:h-9"
            >
              {OVAL_TEES[t].code}
              <span className="font-sans text-[10px] leading-none font-medium tracking-wider uppercase opacity-75">{OVAL_TEES[t].short}</span>
            </button>
          ))}
        </div>
      )}
      {ored && (
        <div className="grid grid-cols-3 gap-2 bg-surface/90 px-3 pt-2">
          <div className="col-span-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Oval reducer type">
            {OVAL_RED_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={redType === t}
                aria-label={`${OVAL_REDS[t].name} (${OVAL_REDS[t].code})`}
                onClick={() => setRedType(t)}
                className="btn-raised btn-raised-sm flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] px-1 font-display text-lg leading-none short:h-10"
              >
                {OVAL_REDS[t].code}
                <span className="font-sans text-[10px] leading-none font-medium tracking-wider uppercase opacity-75">{OVAL_REDS[t].short}</span>
              </button>
            ))}
          </div>
          <label className="flex min-w-0 flex-col" data-testid="oval-red-sizes">
            <span className="truncate text-[11px] font-medium tracking-wide text-muted">B×b · outlet</span>
            <select
              value={szKey(redOut)}
              onChange={(e) => {
                const [a1, a2] = e.target.value.split("x").map(Number);
                setWantRedOut({ A: a1, a: a2 });
              }}
              aria-label="Size B×b · outlet"
              className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
            >
              {redOutList.map((d) => (
                <option key={szKey(d)} value={szKey(d)}>
                  {szText(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {owye && (
        <div className="grid grid-cols-4 gap-2 bg-surface/90 px-3 pt-2">
          <div className="col-span-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Oval wye type">
            {OVAL_WYE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={wyeType === t}
                aria-label={`${OVAL_WYES[t].name} (${OVAL_WYES[t].code})`}
                onClick={() => pickWyeType(t)}
                className="btn-raised btn-raised-sm flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] px-1 font-display text-lg leading-none short:h-10"
              >
                {OVAL_WYES[t].code}
                <span className="font-sans text-[10px] leading-none font-medium tracking-wider uppercase opacity-75">{OVAL_WYES[t].short}</span>
              </button>
            ))}
          </div>
          {wyeType === "ry45" ? (
            (
              [
                ["b", "B×b · left", wyeB, setWantWyeB],
                ["c", "C×c · right", wyeC, setWantWyeC],
              ] as const
            ).map(([id, label, cur, set]) => (
              <label key={id} className="flex min-w-0 flex-col" data-testid="oval-wye-sizes">
                <span className="truncate text-[11px] font-medium tracking-wide text-muted">{label}</span>
                <select
                  value={szKey(cur)}
                  onChange={(e) => {
                    const [a1, a2] = e.target.value.split("x").map(Number);
                    set({ A: a1, a: a2 });
                  }}
                  aria-label={`Size ${label}`}
                  className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
                >
                  {redOutList.map((d) => (
                    <option key={szKey(d)} value={szKey(d)}>
                      {szText(d)}
                    </option>
                  ))}
                </select>
              </label>
            ))
          ) : (
            <p className="col-span-2 self-center text-xs leading-snug text-muted">All three ends A × α ({szText(main)})</p>
          )}
        </div>
      )}
      {!miter && !tee && !ored && !owye && !ocap && (
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
      )}
      {!tee && !ored && !owye && !ocap && (
      <div className="grid grid-cols-3 items-center gap-2 bg-surface/90 px-3 pt-2" role="radiogroup" aria-label="Bend">
        <span className="text-[11px] leading-tight font-medium tracking-wide text-muted uppercase">
          Bend
          <span className="block tracking-normal normal-case">{miter ? miterCode(hard) : `R = 1.5 × ${hard ? "A" : "α"}`}</span>
        </span>
        {OVAL_BENDS.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={bend === b}
            aria-label={miter ? `${b === "hard" ? "Hard" : "Easy"} bend (${miterCode(b === "hard")})` : b === "hard" ? "Hard bend (R = 1.5 × A)" : "Easy bend (R = 1.5 × α)"}
            onClick={() => setBend(b)}
            className="btn-raised btn-raised-sm h-9 rounded-[0.65rem] font-display text-lg leading-none short:h-8"
          >
            {b === "hard" ? "Hard" : "Easy"}
          </button>
        ))}
      </div>
      )}
      {tee && (
        <div className="grid grid-cols-3 gap-2 bg-surface/90 px-3 pt-2" data-testid="oval-tee-sizes">
          {(
            [
              ["out", teeSpec.labels.out, out, outList, setWantOut],
              ["top", teeSpec.labels.top, top, topList, setWantTop],
              ["bottom", teeSpec.labels.bottom, bottom, bottomList, setWantBottom],
            ] as const
          ).map(([id, label, cur, list, set]) =>
            label && cur ? (
              <label key={id} className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-medium tracking-wide text-muted">{label}</span>
                <select
                  value={szKey(cur)}
                  onChange={(e) => {
                    const [a1, a2] = e.target.value.split("x").map(Number);
                    set({ A: a1, a: a2 });
                  }}
                  aria-label={`Size ${label}`}
                  className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
                >
                  {list.map((d) => (
                    <option key={szKey(d)} value={szKey(d)}>
                      {szText(d)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null,
          )}
        </div>
      )}
      <div className="flex items-center gap-2 bg-surface/90 px-3 py-2.5" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <label className="flex w-[4.75rem] min-w-0 shrink-0 flex-col">
          <span className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">A · major</span>
          <select
            value={A}
            onChange={(e) => pickA(Number(e.target.value))}
            aria-label="Size A (major axis)"
            className="btn-raised btn-raised-sm mt-1 h-10 min-w-0 rounded-[0.65rem] px-2 font-display text-lg"
          >
            {majors.map((d) => (
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
            {ocap ? (
              <>
                {capType === "bm" ? (
                  <>
                    B×b <b className="font-semibold">{cd.B}×{cd.b}</b> · H <b className="font-semibold">{OBM_H}&Prime;</b>
                  </>
                ) : capType === "of" ? (
                  <>
                    collar <b className="font-semibold">{OCAP_LEN}&Prime;</b> · flange <b className="font-semibold">{cd.fA}×{cd.fa}</b>
                  </>
                ) : capType === "oec" ? (
                  <>
                    cap <b className="font-semibold">{szText(main)}</b> · skirt <b className="font-semibold">{OEC_SKIRT}&Prime;</b>
                  </>
                ) : (
                  <>
                    {capType === "fc" ? "sleeve" : "band"} <b className="font-semibold">{szText(main)}</b> × <b className="font-semibold">{OCAP_LEN}&Prime;</b>
                  </>
                )}{" "}
                · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
              </>
            ) : owye ? (
              wyeType === "ry45" ? (
                <>
                  R <b className="font-semibold">{inches(wd.RB)}&Prime;</b> B / <b className="font-semibold">{inches(wd.RC)}&Prime;</b> C · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
                </>
              ) : (
                <>
                  Legs 45° · <b className="font-semibold">{inches(wd.reach)}&Prime;</b> · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
                </>
              )
            ) : ored ? (
              <>
                R <b className="font-semibold">{inches(rd.R)}&Prime;</b> · <b className="font-semibold">{inches(rd.L)}&Prime;</b> overall · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
              </>
            ) : tee ? (
              <>
                L <b className="font-semibold">{inches(teeL)}&Prime;</b>
                {teeR > 0 && (
                  <>
                    {" "}
                    · R <b className="font-semibold">{teeR}&Prime;</b>
                  </>
                )}{" "}
                · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
              </>
            ) : miter ? (
              <>
                Vanes <b className="font-semibold">{vanes.n}</b> · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
              </>
            ) : (
              <>
                R = <b className="font-semibold">{inches(R)}&Prime;</b> · <b className="font-semibold">{size?.gauge ?? "–"} ga</b>
              </>
            )}
          </p>
          <p className="truncate text-muted">Gauge assumed (oval chart{ored || owye ? ", inlet" : tee ? ", main" : ""})</p>
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
