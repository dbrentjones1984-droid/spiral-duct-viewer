import * as THREE from "three";
import { flangeScrewCount, JOIN_LENGTH, samples, screwCount, screwMesh, screwScale, type BuiltConnection } from "@/components/duct-connections";

/*
 * Single wall flat-oval spiral duct (Single Wall Duct > Oval), shown at one size: 25" major x 16" minor (Brent:
 * "too many sizes ... just make it 25 major / 16 minor"; the gauge charts list the rest). A flat oval is a rectangle
 * with semicircle ends: 16" minor = 8" end radius, 25 - 16 = 9" flat sections. Pipe axis is X, the minor axis is Y
 * (flats on top and bottom) and the major axis is Z. Coupling and flange work like the round ones (duct-connections.ts).
 */
export const OVAL_MAJOR = 25;
export const OVAL_MINOR = 16;
export const OVAL_R = OVAL_MINOR / 2; // end radius
export const OVAL_FLAT = OVAL_MAJOR - OVAL_MINOR; // flat width
/** Round diameter with the same perimeter (~21.7"): used for screw counts / sizes and detail sizes, like round 20-24". */
export const OVAL_EQ_D = (2 * OVAL_FLAT + Math.PI * OVAL_MINOR) / Math.PI;

const F = OVAL_FLAT;

/**
 * Point on a flat oval whose ends have radius `rho` (same flats), at fraction u of the way around, measured by arc
 * length on the oval of radius `rhoParam` (pass a fixed rhoParam so rings of different size line up, e.g. crimp flutes
 * and the spiral seam). Starts at the middle of the top flat, heading +Z. Returns [y, z, normalY, normalZ].
 */
export function ovalPoint(u: number, rho: number, rhoParam = rho): [number, number, number, number] {
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
}

export const ovalPerimeter = (rho: number) => 2 * F + 2 * Math.PI * rho;

/** Outline for THREE.Shape (shape x = z, shape y = y; the oval is symmetric so the rotateY(90°) mirror doesn't matter). */
export function ovalOutline(rho: number, n: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const [y, z] = ovalPoint(i / n, rho);
    pts.push(new THREE.Vector2(z, y));
  }
  return pts;
}

/** Oval tube along X: rings at xs, end radius rho(x, u) (lets the profile vary along and around, for beads and crimps). */
export function ovalShell(xs: number[], segments: number, rho: (x: number, u: number) => number, uvScale: number, rhoParam = OVAL_R) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const S = segments;
  xs.forEach((x) => {
    for (let j = 0; j <= S; j++) {
      const u = j / S;
      const [y, z] = ovalPoint(u, rho(x, u % 1), rhoParam);
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
}

/** Closed loop around the oval at one X (flange lip, collar bead). */
export class OvalLoop extends THREE.Curve<THREE.Vector3> {
  constructor(
    private rho: number,
    private x: number,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const [y, z] = ovalPoint(t, this.rho);
    return target.set(this.x, y, z);
  }
}

/** Flat oval ring (plate) of thickness t along X (0..t), outer end radius ro, hole ri. */
function ovalRing(ro: number, ri: number, t: number, segs: number, uvScale: number) {
  const shape = new THREE.Shape(ovalOutline(ro, segs));
  shape.holes.push(new THREE.Path(ovalOutline(ri, segs).reverse()));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(Math.PI / 2);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  return g;
}

/** Frame the joint plus the whole short piece and a little of the main pipe (half-major of the widest part). */
function jointFocus(from: number, to: number, outerHalf: number) {
  const half = (to - from) / 2;
  return { focusX: (from + to) / 2, focusR: Math.hypot(half, outerHalf * 1.1) + 1 + OVAL_EQ_D * 0.05 };
}

type Screws = NonNullable<BuiltConnection["screws"]>;

/** Coupling screws: evenly spaced around the oval (by arc length) on both pipe ends, 1" back from the bead each side. */
function buildOvalScrews(mainX: number, pieceX: number, mat: THREE.Material): Screws {
  const n = screwCount(OVAL_EQ_D);
  const k = screwScale(OVAL_EQ_D);
  const group = new THREE.Group();
  const items: Screws["items"] = [];
  [mainX, pieceX].forEach((x, side) => {
    for (let i = 0; i < n; i++) {
      const [y, z, ny, nz] = ovalPoint((i + 0.25 + side * 0.5) / n, OVAL_R);
      const obj = new THREE.Group();
      obj.position.set(x, y, z);
      obj.rotation.x = Math.atan2(nz, ny); // local +Y -> outward normal
      const s = screwMesh(k, mat);
      obj.add(s.obj);
      group.add(obj);
      const win = 0.5;
      const each = win * 0.55;
      const start = side * win + (i / Math.max(1, n - 1)) * (win - each);
      items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
    }
  });
  return { group, items };
}

/** Oval slip coupling: sleeve inside both pipe ends with a raised center bead and crimped ends (same as round). */
export function buildOvalCoupling(pipeEnd: number, sheet: THREE.Material, uvScale: number, screwMat: THREE.Material): BuiltConnection {
  const d = OVAL_EQ_D;
  const R = OVAL_R;
  const wall = Math.max(0.05, d * 0.006);
  const rc = R - wall - 0.03;
  const C = 6;
  const bw = 0.5;
  const bh = R + 0.14 - rc;
  const cl = Math.min(1.25, C * 0.3);
  const flutes = Math.max(24, Math.round(ovalPerimeter(rc) / 0.42));
  const cd = 0.1 + d * 0.003;
  const xs = samples(-C / 2, C / 2, (x) => Math.abs(x) < bw / 2 + 0.1 || C / 2 - Math.abs(x) < cl + 0.05);
  const geo = ovalShell(
    xs,
    flutes * 4,
    (x, u) => {
      let rr = rc;
      if (Math.abs(x) < bw / 2) rr += bh * 0.5 * (1 + Math.cos((Math.PI * x) / (bw / 2)));
      const e = C / 2 - Math.abs(x);
      if (e < cl) rr -= cd * Math.pow(1 - e / cl, 0.8) * 0.5 * (1 - Math.cos(flutes * u * Math.PI * 2));
      return rr;
    },
    uvScale,
    rc,
  );
  const group = new THREE.Group();
  const coupling = new THREE.Group();
  coupling.add(new THREE.Mesh(geo, sheet));
  group.add(coupling);
  const gap = 1.5;
  group.position.x = pipeEnd + gap + C / 2;
  const joinStart = pipeEnd + gap + C + gap;
  const coupleShift = pipeEnd + bw / 2 - group.position.x;
  const pieceShift = pipeEnd + bw - joinStart;
  return {
    group,
    joinStart,
    motion: { parts: [{ obj: coupling, from: 0, to: coupleShift }], piece: { from: 0, to: pieceShift } },
    screws: buildOvalScrews(pipeEnd - 1, pipeEnd + bw + 1, screwMat),
    ...jointFocus(pipeEnd - 4, joinStart + JOIN_LENGTH, OVAL_MAJOR / 2 + 0.1),
  };
}

/** One oval flange: flat ring facing +X (0..t) with a rolled outer lip, collar back into the pipe (-X) with a bead. */
function ovalFlangePart(rc: number, ro: number, t: number, segs: number, ring: THREE.Material, sheet: THREE.Material, uvScale: number) {
  const collar = 2;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(ovalRing(ro, rc, t, segs, uvScale), ring));
  group.add(new THREE.Mesh(ovalShell([-collar, 0], segs, () => rc, uvScale, rc), sheet));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new OvalLoop(ro, t / 2), segs, 0.07, 8, true), ring));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new OvalLoop(rc + 0.02, -0.4), segs, 0.08, 8, true), sheet));
  return group;
}

/** Flange screws through both rings + gasket, parallel to the pipe, evenly spaced around the ring's mid line. */
function buildOvalFlangeScrews(rs: number, faceX: number, mat: THREE.Material): Screws {
  const n = flangeScrewCount(OVAL_EQ_D);
  const k = screwScale(OVAL_EQ_D);
  const group = new THREE.Group();
  const items: Screws["items"] = [];
  const each = 0.4;
  for (let i = 0; i < n; i++) {
    const [y, z] = ovalPoint((i + 0.5) / n, rs);
    const obj = new THREE.Group();
    obj.position.set(faceX, y, z);
    obj.rotation.z = -Math.PI / 2;
    const s = screwMesh(k, mat);
    obj.add(s.obj);
    group.add(obj);
    const start = (i / Math.max(1, n - 1)) * (1 - each);
    items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
  }
  return { group, items };
}

/** Oval flanged joint: same as round (plain rings, 1/8" black rubber gasket, pulled apart ~1" each side; Play closes it). */
export function buildOvalFlange(
  pipeEnd: number,
  ring: THREE.Material,
  sheet: THREE.Material,
  uvScale: number,
  gasketMat: THREE.Material,
  screwMat: THREE.Material,
): BuiltConnection {
  const d = OVAL_EQ_D;
  const R = OVAL_R;
  const wall = Math.max(0.05, d * 0.006);
  const rc = R - wall - 0.03;
  const fw = 1.5;
  const ro = R + fw;
  const t = 0.075;
  const segs = 220;
  const group = new THREE.Group();
  const a = ovalFlangePart(rc, ro, t, segs, ring, sheet, uvScale);
  a.position.x = pipeEnd;
  const b = ovalFlangePart(rc, ro, t, segs, ring, sheet, uvScale);
  b.rotation.y = Math.PI;
  const gt = 0.125;
  const gap = 1;
  const gasket = new THREE.Mesh(ovalRing(ro - 0.02, R + 0.06, gt, segs, uvScale), gasketMat);
  gasket.position.x = pipeEnd + t + gap;
  const joinStart = pipeEnd + t + gap + gt + gap + t;
  b.position.x = joinStart;
  group.add(a, gasket, b);
  const pieceTo = -2 * gap;
  return {
    group,
    joinStart,
    motion: { parts: [{ obj: gasket, from: 0, to: -gap }, { obj: b, from: 0, to: pieceTo }], piece: { from: 0, to: pieceTo } },
    screws: buildOvalFlangeScrews((R + 0.06 + ro - 0.02) / 2, pipeEnd + 2 * t + gt, screwMat),
    ...jointFocus(pipeEnd - 4, joinStart + JOIN_LENGTH, OVAL_MAJOR / 2 + fw + 0.1),
  };
}
