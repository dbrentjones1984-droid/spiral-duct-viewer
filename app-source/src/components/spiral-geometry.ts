import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const DUCT = {
  outerRadius: 7,
  innerRadius: 6,
  length: 48,
  pitch: 3.5,
  flangeLeg: 1.375,
  flangeLip: 0.375,
} as const;

/** Quarter missing toward the camera: cylinder theta (3π/2, 2π), top-front after the axis swap. */
const CUT_START = 0;
const CUT_SWEEP = Math.PI * 1.5;

/** Rounded spiral lock seam: standing rib and a shallow groove beside it. No fasteners. */
function seamOffset(axial: number, angle: number, radius: number, pitch: number) {
  const phase = angle - (axial / pitch) * Math.PI * 2;
  let wrapped = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (wrapped > Math.PI) wrapped -= Math.PI * 2;
  const arc = wrapped * radius;
  const rib = 0.48;
  if (Math.abs(arc) <= rib) {
    const t = arc / rib;
    return 0.26 * (0.5 + 0.5 * Math.cos(t * Math.PI));
  }
  const groove = 0.32;
  if (arc > rib && arc < rib + groove) {
    const t = (arc - rib) / groove;
    return -0.05 * Math.sin(t * Math.PI);
  }
  return 0;
}

function spiralCylinder(
  radius: number,
  length: number,
  pitch: number,
  open: boolean,
  seamed: boolean,
) {
  const thetaLength = open ? CUT_SWEEP : Math.PI * 2;
  const radial = seamed ? 220 : 80;
  const axial = seamed ? Math.round(length / 0.22) : 1;
  const geo = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    radial,
    axial,
    true,
    open ? CUT_START : 0,
    thetaLength,
  );
  if (seamed) {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const angle = Math.atan2(v.z, v.x);
      const rad = Math.hypot(v.x, v.z);
      const next = rad + seamOffset(v.y, angle, rad, pitch);
      pos.setXYZ(i, Math.cos(angle) * next, v.y, Math.sin(angle) * next);
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

export function createSpiralShell(outerRadius: number, length: number, pitch: number, open: boolean) {
  return spiralCylinder(outerRadius, length, pitch, open, false);
}

/** Thin raised helical bead, same pitch as the photo. */
export function createSpiralBead(radius: number, length: number, pitch: number, open: boolean) {
  const steps = Math.max(12, Math.round((length / pitch) * 80));
  const groups: THREE.Vector3[][] = [];
  let current: THREE.Vector3[] = [];
  const keep = (pts: THREE.Vector3[]) => {
    if (pts.length > 2) groups.push(pts);
  };
  for (let i = 0; i <= steps; i++) {
    const x = -length / 2 + (i / steps) * length;
    const angle = (x / pitch) * Math.PI * 2;
    const y = -Math.cos(angle) * (radius + 0.03);
    const z = Math.sin(angle) * (radius + 0.03);
    if (open && y > 0.1 && z > 0.1) {
      keep(current);
      current = [];
      continue;
    }
    current.push(new THREE.Vector3(x, y, z));
  }
  keep(current);
  if (groups.length === 0) return new THREE.BufferGeometry();
  const parts = groups.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, Math.max(2, pts.length - 1), 0.045, 6, false);
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

export function createLiner(innerRadius: number, length: number, open: boolean) {
  return spiralCylinder(innerRadius, length, DUCT.pitch, open, false);
}

/** One flange. `cutStart` lines the missing quarter up after the end is spun onto the pipe. */
export function createRingFlange(
  innerRadius: number,
  outerRadius: number,
  open: boolean,
  cutStart = CUT_START,
) {
  const ri = innerRadius;
  const ro = outerRadius;
  const leg = DUCT.flangeLeg;
  const lip = DUCT.flangeLip;
  const pts = [
    new THREE.Vector2(ri + 0.04, -0.65),
    new THREE.Vector2(ri + 0.04, 0.02),
    new THREE.Vector2(ro + 0.08, 0.04),
    new THREE.Vector2(ro + leg - lip, 0.05),
    new THREE.Vector2(ro + leg - 0.04, 0.12),
    new THREE.Vector2(ro + leg, 0.22),
    new THREE.Vector2(ro + leg - 0.05, lip * 0.85),
    new THREE.Vector2(ro + leg - 0.16, 0.1),
    new THREE.Vector2(ro + 0.18, 0.02),
    new THREE.Vector2(ro + 0.12, -0.6),
    new THREE.Vector2(ri + 0.14, -0.04),
    new THREE.Vector2(ri + 0.12, -0.65),
  ];
  const geo = new THREE.LatheGeometry(pts, open ? 72 : 96, open ? cutStart : 0, open ? CUT_SWEEP : Math.PI * 2);
  geo.computeVertexNormals();
  return geo;
}

/** Fiberglass fill between the liner and the shell. Axis along X. */
export function createInsulation(innerRadius: number, outerRadius: number, length: number, open: boolean) {
  const h = length / 2;
  const pts = [
    new THREE.Vector2(innerRadius + 0.02, -h),
    new THREE.Vector2(outerRadius - 0.04, -h),
    new THREE.Vector2(outerRadius - 0.04, h),
    new THREE.Vector2(innerRadius + 0.02, h),
  ];
  const geo = new THREE.LatheGeometry(
    pts,
    open ? 64 : 72,
    open ? CUT_START : 0,
    open ? CUT_SWEEP : Math.PI * 2,
  );
  geo.computeVertexNormals();
  geo.rotateZ(-Math.PI / 2);
  return geo;
}
