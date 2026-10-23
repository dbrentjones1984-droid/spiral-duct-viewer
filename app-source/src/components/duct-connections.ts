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
    text: "Slides inside both pipe ends (male × male). The center bead stops each pipe; crimped ends start easily. Shown pulled out slightly.",
  },
  flange: {
    title: "Flange",
    text: "Collar slips into the pipe end; the flat ring fastens to a matching flange or equipment. Shown pulled out slightly.",
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
};

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
  const bh = r + 0.1 - rc; // bead stands a little proud of the pipe (it's the stop)
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
  const center = pipeEnd + C / 2 - cl * 0.5; // pulled out of the pipe: only part of one crimp still inside
  group.position.x = center;
  return { group, focusX: center, focusR: r * 1.05 + C * 0.5 + 1 };
}

/**
 * Flange: plain flat ring (rolled outer edge) and a short collar that slips into the pipe end.
 * Shown pulled out 1" so the collar shows.
 */
export function buildFlange(d: number, pipeEnd: number, ring: THREE.Material, sheet: THREE.Material, uvScale: number): BuiltConnection {
  const r = d / 2;
  const wall = Math.max(0.05, d * 0.006);
  const rc = r - wall - 0.03; // collar just inside the pipe
  const fw = d <= 12 ? 1.25 : 1.5; // ring width beyond the pipe
  const ro = r + fw;
  const t = 0.075; // ring thickness
  const collar = 2;
  const segs = Math.min(200, 72 + 5 * d);

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

  group.position.x = pipeEnd + 1;
  return { group, focusX: pipeEnd + 0.6, focusR: ro * 1.3 + 1 };
}
