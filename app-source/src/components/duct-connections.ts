import * as THREE from "three";

/** Single-wall connection options shown on the 3D spiral pipe. Pipe axis is X; sizes in inches. */
export type Connection = "none" | "coupling" | "flange";

export const CONNECTIONS: { id: Connection; label: string }[] = [
  { id: "none", label: "None" },
  { id: "coupling", label: "Coupling" },
  { id: "flange", label: "Flange" },
];

export const CONNECTION_INFO: Record<Exclude<Connection, "none">, { title: string; text: string }> = {
  coupling: {
    title: "Slip coupling",
    text: "Slides inside both pipe ends (male × male); the center bead stops each pipe. Fastened with sheet-metal screws. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Each pipe end gets a flange. A rubber gasket between the rings seals the joint, and screws go through both flanges. Shown pulled apart.",
  },
};

/** Surface of revolution around X: rings at xs, radius(x, angle) lets the profile vary around (crimp flutes). */
export function shell(xs: number[], segments: number, radius: (x: number, a: number) => number, uvScale: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const S = segments;
  xs.forEach((x) => {
    for (let j = 0; j <= S; j++) {
      const a = (j / S) * Math.PI * 2;
      const rr = radius(x, a % (Math.PI * 2));
      pos.push(x, rr * Math.cos(a), rr * Math.sin(a));
      uv.push(j / S, x * uvScale);
    }
  });
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j;
      const b = a + S + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1); // outward-facing
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Smooth across the u=0/u=1 seam.
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

/** Sample points from a to b: fine steps where `fine(x)` (bead / crimps), coarse elsewhere. */
export function samples(a: number, b: number, fine: (x: number) => boolean, fineStep = 0.05, coarseStep = 0.3) {
  const xs = [a];
  let x = a;
  while (x < b - 1e-6) {
    x = Math.min(b, x + (fine(x) ? fineStep : coarseStep));
    xs.push(x);
  }
  return xs;
}

function circle(r: number, n: number, cx = 0, cy = 0) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return pts;
}

export type BuiltConnection = {
  group: THREE.Group;
  /** Point on the axis to frame and the radius of the region to keep in view. */
  focusX: number;
  focusR: number;
  /** X where the short (12") joined pipe piece starts; it runs from here in +X. */
  joinStart: number;
  /**
   * Play animation ("shows them going together"): X offsets from the built (static) pose, at the start (from) and
   * end (to) of the assembly. `parts` are objects inside `group`; `piece` is the 12" pipe piece.
   */
  motion: { parts: { obj: THREE.Object3D; from: number; to: number }[]; piece: { from: number; to: number } };
  /**
   * Play, after the parts are together: sheet-metal screws driven in (coupling: around both pipe ends; flange:
   * through both flange rings). `group` is in model coordinates (add it to the model). Each screw shows from `start`
   * and is seated at `end` (0..1 of the screw phase); `drive` moves out along its local +Y by `lift` and spins about Y.
   */
  screws?: { group: THREE.Group; items: { obj: THREE.Object3D; drive: THREE.Object3D; start: number; end: number; lift: number }[] };
};

/** Screws per pipe end around the coupling joint, by diameter. */
export function screwCount(d: number) {
  return d <= 6 ? 3 : d <= 10 ? 4 : d <= 14 ? 5 : d <= 18 ? 6 : 8;
}

/**
 * Hex-washer-head sheet-metal screw (#10 x 3/4" self-tapper at k = 1; drawn oversized so it reads on screen).
 * Local frame: +Y points out of the pipe; y = 0 is the underside of the washer (sits on the pipe surface),
 * the threaded shank and point go down -Y into the pipe and coupling.
 */
export function screwMesh(k: number, mat: THREE.Material) {
  const g = new THREE.Group();
  const washer = new THREE.CylinderGeometry(0.21 * k, 0.21 * k, 0.04 * k, 20);
  washer.translate(0, 0.02 * k, 0);
  const head = new THREE.CylinderGeometry(0.15 * k, 0.15 * k, 0.13 * k, 6);
  head.translate(0, (0.04 + 0.065) * k, 0);
  const shankL = 0.6 * k;
  const shank = new THREE.CylinderGeometry(0.075 * k, 0.075 * k, shankL, 10);
  shank.translate(0, -shankL / 2, 0);
  const tip = new THREE.ConeGeometry(0.075 * k, 0.15 * k, 10);
  tip.rotateX(Math.PI);
  tip.translate(0, -shankL - 0.075 * k, 0);
  for (const geo of [washer, head, shank, tip]) g.add(new THREE.Mesh(geo, mat));
  // Thread hint: a few thin rings on the shank.
  for (let i = 1; i <= 4; i++) {
    const t = new THREE.TorusGeometry(0.075 * k, 0.018 * k, 4, 12);
    t.rotateX(Math.PI / 2);
    t.translate(0, -i * 0.12 * k, 0);
    g.add(new THREE.Mesh(t, mat));
  }
  return { obj: g, length: shankL + 0.15 * k };
}

/** Screw drawing scale: ~1.6x real size at 12" (more on big pipes, which are seen from farther away) so screws read on a phone. */
export const screwScale = (d: number) => 0.7 * (1.5 + d / 16); // 3": 1.18, 12": 1.58, 24": 2.1

/** Screws through the flange rings, by diameter (Brent: 4 to 6", 6 to 10", 8 to 16", 10 to 20", 12 at 22-24"). */
export function flangeScrewCount(d: number) {
  return d <= 6 ? 4 : d <= 10 ? 6 : d <= 16 ? 8 : d <= 20 ? 10 : 12;
}

/** Screws around both pipe ends, 1" back from the coupling bead on each side, in the assembled pose. */
function buildScrews(d: number, mainX: number, pieceX: number, mat: THREE.Material): NonNullable<BuiltConnection["screws"]> {
  const r = d / 2;
  const n = screwCount(d);
  const k = screwScale(d);
  const group = new THREE.Group();
  const items: NonNullable<BuiltConnection["screws"]>["items"] = [];
  // Main pipe side first, then the 12" piece; within a side they go one after another (overlapping) around the pipe.
  [mainX, pieceX].forEach((x, side) => {
    for (let i = 0; i < n; i++) {
      const a = ((i + side * 0.5) / n) * Math.PI * 2 + Math.PI / 4;
      const obj = new THREE.Group();
      obj.position.set(x, r * Math.cos(a), r * Math.sin(a));
      obj.rotation.x = a; // local +Y -> radial (0, cos a, sin a)
      const s = screwMesh(k, mat);
      obj.add(s.obj);
      group.add(obj);
      const win = 0.5; // each side gets half the phase
      const each = win * 0.55; // one screw's drive time
      const start = side * win + (i / Math.max(1, n - 1)) * (win - each);
      items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
    }
  });
  return { group, items };
}

/** Length of the short pipe piece joined on with the connection (Brent: "maybe a foot long"). */
export const JOIN_LENGTH = 12;


/** Frame the joint plus the whole short piece and a little of the main pipe. */
function jointFocus(d: number, from: number, to: number, outerR: number) {
  const half = (to - from) / 2;
  return { focusX: (from + to) / 2, focusR: Math.hypot(half, outerR * 1.1) + 1 + d * 0.05 };
}

/**
 * Slip coupling: sleeve that fits inside the pipe, raised center bead, corrugated (crimped) ends.
 * Shown pulled most of the way out of the pipe end so the bead and both crimped ends read.
 */
export function buildCoupling(
  d: number,
  pipeEnd: number,
  sheet: THREE.Material,
  uvScale: number,
  screwMat: THREE.Material,
  /** Optional overrides (the fittings viewer's PC uses its sheet's 2" length, screws closer to the bead). */
  opts: { length?: number; screwBack?: number } = {},
): BuiltConnection {
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rc = r - wall - 0.03; // sleeve just inside the pipe
  const C = opts.length ?? (d <= 12 ? 4 : 6); // overall length
  const bw = 0.5; // bead width
  const bh = r + 0.14 - rc; // bead stands a little proud of the pipe (it's the stop)
  const cl = Math.min(1.25, C * 0.3); // crimped length at each end
  const flutes = Math.max(24, Math.round((Math.PI * 2 * rc) / 0.42));
  const cd = 0.1 + d * 0.003; // crimp depth (a touch deep so the flutes read on screen)
  const xs = samples(-C / 2, C / 2, (x) => Math.abs(x) < bw / 2 + 0.1 || C / 2 - Math.abs(x) < cl + 0.05);
  const geo = shell(
    xs,
    flutes * 4,
    (x, a) => {
      let rr = rc;
      if (Math.abs(x) < bw / 2) rr += bh * 0.5 * (1 + Math.cos((Math.PI * x) / (bw / 2)));
      const e = C / 2 - Math.abs(x);
      if (e < cl) rr -= cd * Math.pow(1 - e / cl, 0.8) * 0.5 * (1 - Math.cos(flutes * a));
      return rr;
    },
    uvScale,
  );
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, sheet));
  // Pulled apart (Brent): main pipe | gap | coupling | gap | 12" piece, so both crimped ends show in full.
  const gap = d <= 8 ? 1 : d <= 16 ? 1.25 : 1.5;
  group.position.x = pipeEnd + gap + C / 2;
  const joinStart = pipeEnd + gap + C + gap;
  // Assembled: coupling slid into the main pipe up to the bead, 12" piece slid onto it up to the bead.
  const coupleShift = pipeEnd + bw / 2 - group.position.x;
  const pieceShift = pipeEnd + bw - joinStart;
  const coupling = new THREE.Group();
  coupling.add(...group.children);
  group.add(coupling);
  return {
    group,
    joinStart,
    motion: { parts: [{ obj: coupling, from: 0, to: coupleShift }], piece: { from: 0, to: pieceShift } },
    // Assembled: main pipe ends at pipeEnd, bead pipeEnd..pipeEnd+bw, 12" piece starts at pipeEnd+bw. Screws 1" back each side.
    screws: buildScrews(d, pipeEnd - (opts.screwBack ?? 1), pipeEnd + bw + (opts.screwBack ?? 1), screwMat),
    ...jointFocus(d, pipeEnd - 4, joinStart + JOIN_LENGTH, r + 0.1),
  };
}

/** One flange: plain flat ring (rolled outer edge) facing +X (thickness 0..t), collar going back into the pipe (-X). */
function flangePart(rc: number, ro: number, t: number, segs: number, ring: THREE.Material, sheet: THREE.Material, uvScale: number) {
  const collar = 2;
  const shape = new THREE.Shape(circle(ro, segs));
  shape.holes.push(new THREE.Path(circle(rc, segs).reverse()));
  const plate = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
  plate.rotateY(Math.PI / 2); // face +X, thickness 0..t along X
  const puv = plate.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * uvScale, puv.getY(i) * uvScale);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(plate, ring));

  const col = new THREE.CylinderGeometry(rc, rc, collar, segs, 1, true);
  col.rotateZ(-Math.PI / 2);
  col.translate(-collar / 2, 0, 0);
  group.add(new THREE.Mesh(col, sheet));

  const lip = new THREE.TorusGeometry(ro, 0.07, 8, segs);
  lip.rotateY(Math.PI / 2);
  lip.translate(t / 2, 0, 0);
  group.add(new THREE.Mesh(lip, ring));

  const bead = new THREE.TorusGeometry(rc + 0.02, 0.08, 8, segs);
  bead.rotateY(Math.PI / 2);
  bead.translate(-0.4, 0, 0);
  group.add(new THREE.Mesh(bead, sheet));
  return group;
}

/**
 * Flanged joint (Brent's sketch): a flange on the main pipe end and one on the 12" piece, the two plain flat rings
 * face to face with a black rubber gasket between them for sealing. Static view: pulled apart (about 1" each side of
 * the gasket), no screws or holes (per Brent). Play slides it together flush (flange | gasket | flange), then
 * screws go in through both rings, parallel to the pipe. Collars are inside the pipes.
 */
export function buildFlange(
  d: number,
  pipeEnd: number,
  ring: THREE.Material,
  sheet: THREE.Material,
  uvScale: number,
  gasketMat: THREE.Material,
  screwMat: THREE.Material,
): BuiltConnection {
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rc = r - wall - 0.03; // collar just inside the pipe
  const fw = d <= 12 ? 1.25 : 1.5; // ring width beyond the pipe
  const ro = r + fw;
  const t = 0.075; // ring thickness
  const segs = Math.min(200, 72 + 5 * d);

  const group = new THREE.Group();
  const a = flangePart(rc, ro, t, segs, ring, sheet, uvScale);
  a.position.x = pipeEnd; // ring face pipeEnd..pipeEnd+t
  const b = flangePart(rc, ro, t, segs, ring, sheet, uvScale);
  b.rotation.y = Math.PI; // mirrored: faces -X, collar goes into the 12" piece

  // Rubber gasket: flat ring 1/8" thick, just outside the pipe out to the flange rim (its black edge shows between the rings when assembled).
  const gt = 0.125;
  const gap = 1; // static: about 1" on each side of the gasket
  const gShape = new THREE.Shape(circle(ro - 0.02, segs));
  gShape.holes.push(new THREE.Path(circle(r + 0.06, segs).reverse()));
  const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: gt, bevelEnabled: false, curveSegments: 1 });
  gGeo.rotateY(Math.PI / 2); // thickness along X, 0..gt
  const gasket = new THREE.Mesh(gGeo, gasketMat);
  gasket.position.x = pipeEnd + t + gap;
  const joinStart = pipeEnd + t + gap + gt + gap + t;
  b.position.x = joinStart; // ring face joinStart-t..joinStart
  group.add(a, gasket, b);

  // Play: gasket slides onto flange a, flange b + the 12" piece slide onto the gasket: flange | gasket | flange, flush.
  const pieceTo = -2 * gap;
  const screws = buildFlangeScrews(d, (r + 0.06 + ro - 0.02) / 2, pipeEnd + 2 * t + gt, screwMat);
  return {
    group,
    joinStart,
    motion: { parts: [{ obj: gasket, from: 0, to: -gap }, { obj: b, from: 0, to: pieceTo }], piece: { from: 0, to: pieceTo } },
    screws,
    ...jointFocus(d, pipeEnd - 4, joinStart + JOIN_LENGTH, ro + 0.1),
  };
}

/**
 * Screws through both flange rings and the gasket, parallel to the pipe: heads on the 12" piece's flange (faceX, facing +X),
 * points out the far side of the main pipe's flange. Driven one after another around the ring.
 */
function buildFlangeScrews(d: number, rs: number, faceX: number, mat: THREE.Material): NonNullable<BuiltConnection["screws"]> {
  const n = flangeScrewCount(d);
  const k = screwScale(d);
  const group = new THREE.Group();
  const items: NonNullable<BuiltConnection["screws"]>["items"] = [];
  const each = 0.4; // one screw's drive time (fraction of the screw phase)
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const obj = new THREE.Group();
    obj.position.set(faceX, rs * Math.cos(a), rs * Math.sin(a));
    obj.rotation.z = -Math.PI / 2; // local +Y -> +X (out of the flange face)
    const s = screwMesh(k, mat);
    obj.add(s.obj);
    group.add(obj);
    const start = (i / Math.max(1, n - 1)) * (1 - each);
    items.push({ obj, drive: s.obj, start, end: start + each, lift: s.length + 0.5 * k });
  }
  return { group, items };
}
