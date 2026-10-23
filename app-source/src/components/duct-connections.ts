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
    text: "Slides inside both pipe ends (male × male); the center bead stops each pipe. Shown pulled apart.",
  },
  flange: {
    title: "Flange",
    text: "Each pipe end gets a flange. The two flat rings are screwed together face to face (shown slightly apart).",
  },
};

/** Surface of revolution around X: rings at xs, radius(x, angle) lets the profile vary around (crimp flutes). */
function shell(xs: number[], segments: number, radius: (x: number, a: number) => number, uvScale: number) {
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
function samples(a: number, b: number, fine: (x: number) => boolean, fineStep = 0.05, coarseStep = 0.3) {
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
};

/** Length of the short pipe piece joined on with the connection (Brent: "maybe a foot long"). */
export const JOIN_LENGTH = 12;

/** How far (in.) the flanged 12" piece starts beyond its static 5/8" gap when the assembly is played. */
const FLANGE_PLAY_START = 3;

/** Frame the joint plus the whole short piece and a little of the main pipe. */
function jointFocus(d: number, from: number, to: number, outerR: number) {
  const half = (to - from) / 2;
  return { focusX: (from + to) / 2, focusR: Math.hypot(half, outerR * 1.1) + 1 + d * 0.05 };
}

/**
 * Slip coupling: sleeve that fits inside the pipe, raised center bead, corrugated (crimped) ends.
 * Shown pulled most of the way out of the pipe end so the bead and both crimped ends read.
 */
export function buildCoupling(d: number, pipeEnd: number, sheet: THREE.Material, uvScale: number): BuiltConnection {
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rc = r - wall - 0.03; // sleeve just inside the pipe
  const C = d <= 12 ? 4 : 6; // overall length
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
 * face to face, shown 5/8 in. apart (they are screwed together; no screws or holes drawn, per Brent). Collars are inside the pipes.
 */
export function buildFlange(d: number, pipeEnd: number, ring: THREE.Material, sheet: THREE.Material, uvScale: number): BuiltConnection {
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rc = r - wall - 0.03; // collar just inside the pipe
  const fw = d <= 12 ? 1.25 : 1.5; // ring width beyond the pipe
  const ro = r + fw;
  const t = 0.075; // ring thickness
  const segs = Math.min(200, 72 + 5 * d);

  const group = new THREE.Group();
  const a = flangePart(rc, ro, t, segs, ring, sheet, uvScale);
  a.position.x = pipeEnd;
  const b = flangePart(rc, ro, t, segs, ring, sheet, uvScale);
  b.rotation.y = Math.PI; // mirrored: faces -X, collar goes into the 12" piece
  const gap = 0.625; // 5/8" between the rings: shown slightly apart (Brent), each flange stays on its own pipe
  const joinStart = pipeEnd + 2 * t + gap;
  b.position.x = joinStart;
  group.add(a, b);

  // Play: the 12" piece and its flange start a few inches away and slide in until the rings meet flush.
  const start = FLANGE_PLAY_START;
  const move = { from: start, to: -gap };
  return {
    group,
    joinStart,
    motion: { parts: [{ obj: b, ...move }], piece: move },
    ...jointFocus(d, pipeEnd - 4, joinStart + start + JOIN_LENGTH, ro + 0.1),
  };
}
