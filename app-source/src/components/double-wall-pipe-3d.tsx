import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { HomeButton } from "@/components/home-button";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildFlangeScrews, buildScrews, type BuiltConnection } from "@/components/duct-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";
import { DW_INS, DW_ROUND_3D_HASH, dwRoundHash, type DwConn, type DwIns, type DwType } from "@/lib/route";
import { STOCK_DIAMETERS, stockGauge } from "@/lib/sheets";

/*
 * Interactive 3D model of double wall round spiral pipe (Double Wall Duct > Round), from Brent's sheet 1:
 * a solid outer spiral shell, fiberglass insulation (1", 2" or 3", 1-1/2 lb density; 1" standard) and an inner spiral
 * liner, solid (Solid / Solid) or perforated (Solid / Perforated). A cutaway window (outer shell cut back further than
 * the insulation, so the layers step down) shows all three layers. Connection (Brent): Coupling (standard slip joint:
 * a short plain pipe coupling for the inner shells, connected and screwed first, then a short pipe coupling for
 * the outer shells with a bead around its middle, which the outer shells slide onto and are screwed to) or Flange (each end capped by one flange; the ends meet face to face on a gasket and
 * are screwed), or None (one section, layers only). Play runs the steps in order with a caption for each.
 *
 * Assumptions (not on the sheet, flagged in the UI): outer diameter = inner + 2 x insulation; gauges for both shells
 * from the single wall round chart (by each shell's diameter); perforation 3/32" holes on 3/16" stagger (Double Wall
 * Submittal) drawn 4x larger so they read on a phone; at a coupling joint both couplings slip inside (like the single
 * wall PC, lengths by its rule), the inner shells meet butt on the inner coupling, the outer shells slide together
 * onto the outer coupling to its bead, and the insulation stops clear of the outer coupling; at a flanged joint (Brent's sketch) there is no inner coupling: each end is capped by one
 * flange ring that the outer shell and liner both run out to, with the single wall flange's gasket and screws.
 * Units are inches; pipe axis is X.
 */

export const STEP_PAUSE_MS = 250;
export const SCREW_TURNS = 4;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";
type ScrewItem = NonNullable<BuiltConnection["screws"]>["items"][number];

/** Play captions (0 = shown apart, before Play; then one per step; the last when assembled). * = assumed. */
const STEPS: Record<Exclude<DwConn, "none">, { title: string; text: string }[]> = {
  coupling: [
    { title: "Coupling · inner + outer", text: "Shown apart: the inner shells stick out past the outer shells; the outer pipe coupling (bead) and inner pipe coupling sit between. Press Play." },
    { title: "1 · Inner coupling", text: "The inner coupling slides into the lower inner shell, then the inner shells slide together on it." },
    { title: "2 · Screw the inner shells", text: "Screws go through both inner shells into the inner coupling." },
    { title: "3 · Outer coupling", text: "The outer coupling drops over the joint and the outer shells* slide together onto it, up to its bead." },
    { title: "4 · Screw the outer shells", text: "Screws go through both outer shells into the outer coupling." },
    { title: "Assembled", text: "Inner connected first, then the outer. * assumed" },
  ],
  flange: [
    { title: "Flange · each end capped", text: "Shown apart. Outer shell and inner liner both run out to one flange ring that caps the insulation; gasket between. Press Play." },
    { title: "1 · Flanges together", text: "The pipe ends meet flange face to face on the gasket." },
    { title: "2 · Screw the flanges", text: "Screws go through both flanges and the gasket." },
    { title: "Assembled", text: "Flanged joint: one flange per end, gasket, screws. * assumed" },
  ],
};
const CONN_LABEL: Record<DwConn, string> = { none: "None", coupling: "Coupling", flange: "Flange" };

const SECTION_LENGTH = 48; // 4 ft shown (pipe comes 1 to 20 ft, specify when ordering)
const STRIP_PITCH = 5.6;
/** Cutaway window: around +Z, tipped toward the default camera, so it faces you in both layouts. */
const CUT_A0 = THREE.MathUtils.degToRad(22);
const CUT_A1 = THREE.MathUtils.degToRad(158);
const CUT_OUTER = 13; // outer shell open for |x| < this (main section)
const CUT_STEP = 4; // insulation cut back this much less, so it steps down
const INS_SETBACK = 3; // insulation held back at each pipe end (outer coupling room; assumed)
export const PERF_TILE = 0.75; // drawn perforation pitch (real 3/16" stagger, 4x)
// Joint views: the main section ends at the joint, the next section comes in from +X.
const MAIN_LENGTH = 30;
const PIECE_LENGTH = 22;
const BEAD = 0.5; // outer coupling's center bead width (as the single wall PC, duct-connections buildCoupling)
export const FLANGE_T = 0.12; // flange ring thickness as drawn
export const GASKET_T = 0.125; // gasket (single wall flange)
export const FLANGE_APART = 4; // flanged joint: how far apart the ends start

/** Spread screws evenly over their phase (after the cut-away side's screws are dropped). */
function retime(items: ScrewItem[]) {
  const each = 0.3;
  items.forEach((it, i) => {
    it.start = items.length > 1 ? (i / (items.length - 1)) * (1 - each) : 0;
    it.end = it.start + each;
  });
}

/** Part of a cylinder of radius r: x0..x1 along X, angles a0..a1. UVs in inches (u around, v along). */
/** (rEnd: radius at x1, for a cone, e.g. a swaged step; defaults to r.) */
function cylPatch(r: number, x0: number, x1: number, a0: number, a1: number, segA: number, segX = 1, rEnd = r) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segX; i++) {
    const x = x0 + ((x1 - x0) * i) / segX;
    for (let j = 0; j <= segA; j++) {
      const a = a0 + ((a1 - a0) * j) / segA;
      const rr = r + ((rEnd - r) * i) / segX;
      pos.push(x, rr * Math.cos(a), rr * Math.sin(a));
      nor.push(0, Math.cos(a), Math.sin(a));
      uv.push(r * a, x);
    }
  }
  for (let i = 0; i < segX; i++) {
    for (let j = 0; j < segA; j++) {
      const a = i * (segA + 1) + j;
      const b = a + segA + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1); // outward-facing
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Flat face at angle a from radius r0 to r1, x0..x1 (a cut edge). */
function radialFace(r0: number, r1: number, x0: number, x1: number, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, r0 * c, r0 * s, x1, r0 * c, r0 * s, x0, r1 * c, r1 * s, x1, r1 * c, r1 * s], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([r0, x0, r0, x1, r1, x0, r1, x1], 2));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  g.computeVertexNormals();
  return g;
}

/** Flat annulus sector in the plane x (end faces and the window's cut ends). */
export function ringSector(r0: number, r1: number, a0: number, a1: number, x: number, seg: number) {
  const g = new THREE.RingGeometry(r0, r1, seg, 1, a0, a1 - a0);
  // RingGeometry is in XY (angle from +X toward +Y); map its (X, Y) to our (Y, Z) at the given x.
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const py = p.getY(i);
    p.setXYZ(i, x, px, py);
    uv.setXY(i, px, py);
  }
  g.computeVertexNormals();
  return g;
}

/** Helix rib (lock seam) at radius r over x0..x1, skipping where `hole` says the shell is cut away (runs split there). */
function seamRuns(r: number, x0: number, x1: number, phase: number, tubeR: number, hole: ((x: number, a: number) => boolean) | null) {
  const geos: THREE.BufferGeometry[] = [];
  const s0 = x0 + tubeR * 2;
  const s1 = x1 - tubeR * 2;
  if (s1 - s0 < 1) return geos;
  const n = Math.max(8, Math.round(((s1 - s0) / STRIP_PITCH) * 72));
  let run: THREE.Vector3[] = [];
  const flush = () => {
    if (run.length >= 3) geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length * 2, tubeR, 6, false));
    run = [];
  };
  for (let i = 0; i <= n; i++) {
    const x = s0 + ((s1 - s0) * i) / n;
    const a = (x / STRIP_PITCH) * Math.PI * 2 + phase;
    const am = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (hole?.(x, am)) {
      flush();
      continue;
    }
    run.push(new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r));
  }
  flush();
  return geos;
}

export type DwMats = { outer: THREE.Material; seam: THREE.Material; edge: THREE.Material; insul: THREE.Material; insulCut: THREE.Material; liner: THREE.Material; linerSeam: THREE.Material };
type Range = [number, number];

/** Wall thickness as drawn (a little thicker than real so the cut edges read). */
export const drawWall = (d: number) => Math.max(0.06, d * 0.006);
export const segsFor = (od: number) => Math.min(180, 72 + Math.round(od * 3));
const inCut = (a: number) => a > CUT_A0 && a < CUT_A1;

/**
 * Tube wall from r0 to r1 over x from..to, drawn as surfaces at `radii`, open over the cutaway angles inside each
 * window (cut faces between r0 and r1 along the window's sides and at its inner ends; end rings at from / to).
 */
function tube(add: (g: THREE.BufferGeometry, m: THREE.Material) => void, radii: number[], r0: number, r1: number, from: number, to: number, wins: Range[], surf: THREE.Material, cut: THREE.Material, end: THREE.Material, segFull: number) {
  const segCut = Math.max(4, Math.round((segFull * (CUT_A1 - CUT_A0)) / (Math.PI * 2)));
  const segRest = segFull - segCut;
  const eps = 1e-3;
  const ws = wins.map(([a, b]): Range => [Math.max(a, from), Math.min(b, to)]).filter(([a, b]) => b - a > eps).sort((p, q) => p[0] - q[0]);
  const parts: [number, number, boolean][] = [];
  let x = from;
  for (const [a, b] of ws) {
    if (a > x + eps) parts.push([x, a, false]);
    parts.push([a, b, true]);
    x = b;
  }
  if (x < to - eps) parts.push([x, to, false]);
  for (const [a, b, open] of parts) {
    if (open) {
      for (const r of radii) add(cylPatch(r, a, b, CUT_A1, CUT_A0 + Math.PI * 2, segRest, 4), surf);
      for (const ang of [CUT_A0, CUT_A1]) add(radialFace(r0, r1, a, b, ang), cut);
      if (a > from + eps) add(ringSector(r0, r1, CUT_A0, CUT_A1, a, segCut), cut);
      if (b < to - eps) add(ringSector(r0, r1, CUT_A0, CUT_A1, b, segCut), cut);
    } else {
      for (const r of radii) add(cylPatch(r, a, b, 0, Math.PI * 2, segFull, Math.max(1, Math.round((b - a) / 12))), surf);
    }
  }
  for (const xe of [from, to]) {
    const open = ws.some(([a, b]) => xe >= a - eps && xe <= b + eps);
    add(open ? ringSector(r0, r1, CUT_A1, CUT_A0 + Math.PI * 2, xe, segRest) : ringSector(r0, r1, 0, Math.PI * 2, xe, segFull), end);
  }
}

/**
 * One double wall pipe section (inner liner, insulation, outer shell), each layer over its own x range, with cutaway
 * windows (o: outer shell, i: insulation; the insulation window is a little smaller so the layers step down).
 * ID = inner liner diameter, t = insulation thickness; outer shell radius = ID / 2 + t.
 */
export function buildSection(ID: number, t: number, m: DwMats, spec: { liner?: Range; outer?: Range; ins?: Range; win: { o: Range; i: Range }[] }) {
  const group = new THREE.Group();
  const ri = ID / 2;
  const ro = ri + t;
  const w = drawWall(ID + 2 * t);
  const segFull = segsFor(ID + 2 * t);
  const add = (g: THREE.BufferGeometry, mat: THREE.Material) => group.add(new THREE.Mesh(g, mat));

  // ---- Outer shell (solid) with its lock seam (split around the windows).
  if (spec.outer) tube(add, [ro], ro - w, ro + 0.005, spec.outer[0], spec.outer[1], spec.win.map((x) => x.o), m.outer, m.edge, m.edge, segFull);
  const rib = Math.min(0.2, 0.09 + (ID + 2 * t) * 0.004);
  const hole = (x: number, a: number) => spec.win.some(({ o }) => x > o[0] - rib && x < o[1] + rib) && a > CUT_A0 - rib / ro && a < CUT_A1 + rib / ro;
  if (spec.outer) {
    for (const g of seamRuns(ro + rib * 0.15, spec.outer[0], spec.outer[1], 0, rib, hole)) add(g, m.seam);
    for (const g of seamRuns(ro + rib * 0.05, spec.outer[0], spec.outer[1], (rib * 2.1) / ro, rib * 0.75, hole)) add(g, m.seam);
  }

  // ---- Insulation (fiberglass): inner face just outside the liner, outer face inside the outer shell.
  if (spec.ins) tube(add, [ri + w * 0.6, ro - w], ri + w * 0.6, ro - w, spec.ins[0], spec.ins[1], spec.win.map((x) => x.i), m.insul, m.insulCut, m.insulCut, segFull);

  // ---- Inner liner (solid or perforated): both sides drawn, with its own lock seam.
  if (!spec.liner) return group;
  const [l0, l1] = spec.liner;
  add(cylPatch(ri, l0, l1, 0, Math.PI * 2, segFull, Math.max(2, Math.round((l1 - l0) / 12))), m.liner);
  for (const x of [l0, l1]) add(ringSector(ri - w * 0.5, ri + w * 0.5, 0, Math.PI * 2, x, segFull), m.edge);
  const lrib = rib * 0.55;
  for (const g of seamRuns(ri + lrib * 0.4, l0, l1, 0.6, lrib, null)) add(g, m.linerSeam);
  return group;
}

/**
 * Pipe coupling for the outer shells (Brent's drawing): short sleeve just inside the outer shells (male, like the
 * single wall PC) with a raised bead around its middle; the outer shells slide onto it and meet at the bead. Cut away
 * like the shells so the inner joint shows. Centered on x = 0.
 */
function buildOuterPC(ro: number, len: number, w: number, segFull: number, mat: THREE.Material, edge: THREE.Material) {
  const group = new THREE.Group();
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => group.add(new THREE.Mesh(g, m));
  const rc = ro - w - 0.03;
  const h = len / 2;
  const all: Range[] = [[-h - 1, h + 1]];
  tube(add, [rc], rc - w, rc, -h, h, all, mat, edge, edge, segFull);
  tube(add, [ro + 0.14], rc, ro + 0.14, -BEAD / 2, BEAD / 2, all, mat, edge, edge, segFull);
  return group;
}

/** Pipe coupling for the inner shells (Brent's drawing): short plain sleeve just inside the inner shells. Centered on x = 0. */
function buildInnerPC(ri: number, len: number, w: number, segFull: number, mat: THREE.Material, edge: THREE.Material) {
  const group = new THREE.Group();
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => group.add(new THREE.Mesh(g, m));
  const rc = ri - w * 0.5 - 0.03;
  tube(add, [rc, rc - w], rc - w, rc, -len / 2, len / 2, [], mat, edge, edge, segFull);
  return group;
}

/** Flat ring x0..x1 from r0 to r1 (flange plate or gasket), with a rolled lip at the rim when `lip`. */
export function flatRing(r0: number, r1: number, x0: number, x1: number, segs: number, mat: THREE.Material, lip: boolean) {
  const group = new THREE.Group();
  const add = (g: THREE.BufferGeometry) => group.add(new THREE.Mesh(g, mat));
  add(ringSector(r0, r1, 0, Math.PI * 2, x0, segs));
  add(ringSector(r0, r1, 0, Math.PI * 2, x1, segs));
  add(cylPatch(r1, x0, x1, 0, Math.PI * 2, segs));
  add(cylPatch(r0, x0, x1, 0, Math.PI * 2, segs));
  if (lip) {
    const tor = new THREE.TorusGeometry(r1, 0.07, 8, segs);
    tor.rotateY(Math.PI / 2);
    tor.translate((x0 + x1) / 2, 0, 0);
    add(tor);
  }
  return group;
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

/** Perforation alpha map: staggered round holes (black = hole) on a square tile, one in the middle, quarters in the corners. */
export function perfTexture() {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, s, s);
  g.fillStyle = "#000";
  const r = s * 0.2;
  for (const [x, y] of [[s / 2, s / 2], [0, 0], [s, 0], [0, s], [s, s]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / PERF_TILE, 1 / PERF_TILE);
  tex.anisotropy = 4;
  return tex;
}

/** Fiberglass: warm yellow with soft fibrous streaks. */
export function fiberTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e6c45e";
  g.fillRect(0, 0, s, s);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const len = 6 + rnd() * 26;
    const a = (rnd() - 0.5) * 1.2;
    const l = 150 + Math.round(rnd() * 90);
    g.strokeStyle = `rgba(${l + 20},${l},${Math.round(l * 0.45)},0.35)`;
    g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y + (rnd() - 0.5) * 8, x + len * Math.cos(a), y + len * Math.sin(a));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / 5, 1 / 5);
  return tex;
}

export const TYPE_LABEL: Record<DwType, string> = { ss: "Solid / Solid", sp: "Solid / Perforated" };

export default function DoubleWallPipe3D({
  onClose,
  initialType = "ss",
  initialIns = 1,
  initialConn = "coupling",
}: {
  onClose: () => void;
  initialType?: DwType;
  initialIns?: DwIns;
  initialConn?: DwConn;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    set: (d: number, t: DwIns, type: DwType, c: DwConn) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [diameter, setDiameter] = useState(12);
  const [type, setType] = useState<DwType>(initialType);
  const [ins, setIns] = useState<DwIns>(initialIns);
  const [connection, setConnection] = useState<DwConn>(initialConn);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const od = diameter + 2 * ins;
  const gOuter = stockGauge(od).pipe;
  const gLiner = stockGauge(diameter).pipe;

  // Follow a deep link change (back / forward) to another type or insulation.
  useEffect(() => setType(initialType), [initialType]);
  useEffect(() => setIns(initialIns), [initialIns]);
  useEffect(() => setConnection(initialConn), [initialConn]);
  // Keep the address on the shown type + insulation (replace, so the back button still closes the model).
  useEffect(() => {
    if (location.hash.startsWith(DW_ROUND_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwRoundHash(type, ins, connection));
  }, [type, ins, connection]);

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
    scene.add(new THREE.HemisphereLight(0xf4f7fb, 0x7d8b99, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 60, 40);
    scene.add(sun);

    const spangle = spangleTexture();
    spangle.repeat.set(1 / 10, 1 / 10); // UVs are in inches
    const fiber = fiberTexture();
    const perf = perfTexture();
    const outer = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangle, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95, side: THREE.DoubleSide });
    const seam = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.3, side: THREE.DoubleSide });
    const insul = new THREE.MeshStandardMaterial({ color: 0xf0b640, map: fiber, metalness: 0, roughness: 0.95, envMapIntensity: 0.55, side: THREE.DoubleSide });
    // Cut faces of the insulation: a deeper yellow so the blanket thickness reads against its outer face.
    const insulCut = new THREE.MeshStandardMaterial({ color: 0xd9962a, map: fiber, metalness: 0, roughness: 1, envMapIntensity: 0.45, side: THREE.DoubleSide });
    // Liner a touch darker than the outer shell so the two shells read apart in the cutaway.
    const linerSolid = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangle, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85, side: THREE.DoubleSide });
    const linerPerf = linerSolid.clone();
    linerPerf.alphaMap = perf;
    linerPerf.alphaTest = 0.5;
    linerPerf.alphaToCoverage = true;
    const linerSeam = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.85, roughness: 0.35 });
    const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.8, roughness: 0.24, envMapIntensity: 1.25, side: THREE.DoubleSide });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    // Flange gasket: dark matte black rubber (as on the single wall flange).
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4, side: THREE.DoubleSide });

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    // No auto-spin: the cutaway is turned toward you and stays there until you drag.
    controls.autoRotate = false;
    controls.addEventListener("start", () => setHint(false));

    let model: THREE.Group | null = null;
    let focus: { focusX: number; focusR: number } | null = null;
    let fitDistance = 100;
    const frame = (d: number) => {
      const upright = camera.aspect < 0.9;
      if (!model) return;
      model.rotation.z = upright ? Math.PI / 2 : 0;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      if (upright) {
        shadow.scale.set(d * 2.4, d * 2.4, 1);
        shadow.position.set(0, box.min.y - 0.05, 0);
      } else {
        shadow.scale.set((box.max.x - box.min.x) * 1.15, d * 2.2, 1);
        shadow.position.set((box.max.x + box.min.x) / 2, -d / 2 - 0.05, 0);
      }
      const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const along = SECTION_LENGTH / 2 + d * 0.3;
      const across = d / 2 + d * 0.15;
      const halfH = upright ? along : across + SECTION_LENGTH * 0.12;
      const halfW = upright ? across : along * 0.92;
      fitDistance = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.12 + d / 2;
      if (focus) {
        // Upright: aim a little below the joint so it sits above the caption box.
        const at = model.localToWorld(new THREE.Vector3(focus.focusX - (upright ? focus.focusR * 0.22 : 0), 0, 0));
        const dist = focus.focusR / Math.sin(Math.min(vHalf, hHalf));
        const dir = (upright ? new THREE.Vector3(0.55, 0.5, 1) : new THREE.Vector3(1, 0.45, 0.9)).normalize();
        camera.position.copy(at).addScaledVector(dir, dist);
        controls.target.copy(at);
      } else {
        const dir = (upright ? new THREE.Vector3(0.42, 0.3, 1) : new THREE.Vector3(0.45, 0.42, 1)).normalize();
        camera.position.copy(dir.multiplyScalar(fitDistance));
        controls.target.set(0, 0, 0);
      }
      controls.minDistance = Math.max(2, d * 0.35);
      controls.maxDistance = fitDistance * 2.2;
      camera.near = Math.max(0.05, d * 0.02);
      camera.far = fitDistance * 6;
      camera.updateProjectionMatrix();
      controls.update();
    };

    // ---- Play: a list of steps run one after another. A step slides parts along the pipe axis (offsets add up, so a
    // part carried by another, e.g. the outer coupling parked on the next section, moves with it) or drives a set of
    // screws. Each step has a caption (index into the connection's STEPS list).
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
        for (const m of st.moves ?? []) off.set(m.obj, (off.get(m.obj) ?? 0) + m.delta * easeInOut(p));
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

    let cur = { d: 12, t: 1 as DwIns, type: "ss" as DwType, c: initialConn };
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const { d, t, type: ty, c } = cur;
      const OD = d + 2 * t;
      const ro = d / 2 + t;
      const w = drawWall(OD);
      const segs = segsFor(OD);
      const mats: DwMats = { outer, seam, edge, insul, insulCut, liner: ty === "sp" ? linerPerf : linerSolid, linerSeam };
      model = new THREE.Group();
      steps = [];
      bases = new Map();
      allScrews = [];
      const pause: Step = { ms: STEP_PAUSE_MS, cap: -1 };
      const move = (obj: THREE.Object3D, delta: number) => {
        if (!bases.has(obj)) bases.set(obj, obj.position.x);
        return { obj, delta };
      };
      if (c === "none") {
        // One 4' section, cut away in the middle; insulation held back from the ends.
        const h = SECTION_LENGTH / 2;
        const ie = h - INS_SETBACK;
        model.add(buildSection(d, t, mats, { liner: [-h, h], outer: [-h, h], ins: [-ie, ie], win: [{ o: [-CUT_OUTER, CUT_OUTER], i: [-CUT_OUTER + CUT_STEP, CUT_OUTER - CUT_STEP] }] }));
        focus = null;
      } else if (c === "coupling") {
        // Brent's drawing, top to bottom: outer shell, inner shell sticking out, pipe coupling for the outer shells
        // (bead), pipe coupling for the inner shells, inner shell sticking out, outer shell. Inner connects first, then
        // the outer. Main section A below (liner ends at x = 0), section B above; each section's outer shell +
        // insulation (aO / bO) start pulled back so the inner shell sticks out P, and slide together at the end onto
        // the outer coupling, meeting at its bead (x = +-BEAD / 2). Coordinates are the assembled positions.
        const Ci = d <= 12 ? 4 : 6; // inner coupling length (single wall PC rule)
        const Co = OD <= 12 ? 4 : 6; // outer coupling length (single wall PC rule)
        const P = Co + 0.75; // inner shell sticks out this far past the pulled-back outer shell
        const back = P - BEAD / 2; // how far each outer shell is pulled back
        const gap = d <= 8 ? 1 : d <= 16 ? 1.25 : 1.5;
        const insEnd = Co / 2 + 0.1; // insulation stops clear of the outer coupling
        const bead = BEAD / 2;
        model.add(buildSection(d, t, mats, { liner: [-MAIN_LENGTH, 0], win: [] }));
        const aO = buildSection(d, t, mats, { outer: [-MAIN_LENGTH, -bead], ins: [-MAIN_LENGTH, -insEnd], win: [{ o: [-bead - 13, -bead], i: [-bead - 9, -insEnd] }] });
        aO.position.x = -back;
        model.add(aO);
        const innerPC = buildInnerPC(d / 2, Ci, w, segs, couplingMat, edge);
        innerPC.position.x = gap + Ci / 2;
        model.add(innerPC);
        const S = gap + Ci + gap + Co + gap; // B's inner shell starts here, apart
        const B = new THREE.Group();
        B.position.x = S;
        model.add(B);
        B.add(buildSection(d, t, mats, { liner: [0, PIECE_LENGTH], win: [] }));
        const bO = buildSection(d, t, mats, { outer: [bead, PIECE_LENGTH], ins: [insEnd, PIECE_LENGTH], win: [{ o: [bead, bead + 13], i: [insEnd, bead + 9] }] });
        bO.position.x = back;
        B.add(bO);
        const outerPC = buildOuterPC(ro, Co, w, segs, couplingMat, edge);
        const parkAt = Co / 2 + 0.4; // waiting on B's inner shell, just below its pulled-back outer shell
        outerPC.position.x = -gap - Co / 2; // apart: between the inner coupling and B
        B.add(outerPC);
        // Screws: inner shells into the inner coupling, then outer shells into the outer coupling (skipping the
        // cut-away side: no sheet there to hold them).
        const innerS = buildScrews(d, -Ci / 4, Ci / 4, screwMat);
        model.add(innerS.group);
        const outerS = buildScrews(OD, -bead - Co / 4, bead + Co / 4, screwMat);
        const keep = outerS.items.filter((it) => {
          const ang = ((it.obj.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const ok = !(ang > CUT_A0 - 0.25 && ang < CUT_A1 + 0.25);
          if (!ok) outerS.group.remove(it.obj);
          return ok;
        });
        retime(keep);
        model.add(outerS.group);
        allScrews = [...innerS.items, ...keep];
        steps = [
          { ms: 1400, cap: 1, moves: [move(innerPC, -(gap + Ci / 2)), move(outerPC, parkAt + gap + Co / 2)] },
          { ms: 1500, cap: 1, moves: [move(B, -S)] },
          { ...pause, cap: 2 },
          { ms: 2200, cap: 2, screws: innerS.items },
          { ...pause, cap: 3 },
          { ms: 1300, cap: 3, moves: [move(outerPC, -parkAt)] },
          { ms: 1600, cap: 3, moves: [move(aO, back), move(bO, -back)] },
          { ...pause, cap: 4 },
          { ms: 2200, cap: 4, screws: keep },
        ];
        const f0 = -P - 4;
        const f1 = S + P + 4;
        focus = { focusX: (f0 + f1) / 2, focusR: Math.hypot((f1 - f0) / 2, ro + 0.6) * 1.05 };
      } else {
        // Flanged (Brent's sketch): no inner coupling. Each pipe end is capped by one flange ring: the outer shell and
        // the inner liner both run out to it and it closes off the insulation. The ends meet flange face to face on
        // the gasket; screws through both flanges (as the single wall flange).
        const fw = OD <= 12 ? 1.25 : 1.5;
        const rf = ro + fw;
        const ft = FLANGE_T;
        const gt = GASKET_T;
        const S = FLANGE_APART;
        const B = new THREE.Group();
        B.position.x = S;
        model.add(B);
        const r0 = d / 2 - w * 0.5;
        model.add(buildSection(d, t, mats, { liner: [-MAIN_LENGTH, -ft], outer: [-MAIN_LENGTH, -ft], ins: [-MAIN_LENGTH, -ft], win: [{ o: [-14, -ft], i: [-10, -ft] }] }));
        model.add(flatRing(r0, rf, -ft, 0, segs, couplingMat, true));
        const b0 = gt + ft;
        B.add(buildSection(d, t, mats, { liner: [b0, b0 + PIECE_LENGTH], outer: [b0, b0 + PIECE_LENGTH], ins: [b0, b0 + PIECE_LENGTH], win: [{ o: [b0, b0 + 14], i: [b0, b0 + 10] }] }));
        B.add(flatRing(r0, rf, gt, b0, segs, couplingMat, true));
        const gasket = flatRing(r0 + 0.02, rf - 0.03, 0, gt, segs, gasketMat, false);
        gasket.position.x = S / 2;
        model.add(gasket);
        const fS = buildFlangeScrews(OD, (ro + rf) / 2, b0, screwMat);
        model.add(fS.group);
        allScrews = fS.items;
        steps = [
          { ms: 1900, cap: 1, moves: [move(B, -S), move(gasket, -S / 2)] },
          { ...pause, cap: 2 },
          { ms: 2400, cap: 2, screws: fS.items },
        ];
        focus = { focusX: S / 2, focusR: Math.hypot(S / 2 + 7, rf + 0.3) * 0.85 };
      }
      doneCap = c === "none" ? 0 : STEPS[c].length - 1;
      steps = steps.map((st, i) => (st.cap === -1 ? { ...st, cap: steps[i + 1]?.cap ?? 0 } : st));
      playMs = steps.reduce((sum, st) => sum + st.ms, 0);
      stopPlay();
      scene.add(model);
      renderer.domElement.setAttribute(
        "aria-label",
        `3D double wall spiral pipe, ${TYPE_LABEL[ty]}, ${d} inch inside, ${t} inch insulation, ${OD} inch outside, ${c === "none" ? "cut away to show the layers" : c === "coupling" ? "inner and outer coupling joint, cut away" : "flanged joint, cut away"}. Drag to turn, pinch to zoom.`,
      );
      frame(OD);
    };

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      frame(cur.d + 2 * cur.t);
    });
    ro.observe(el);

    api.current = {
      set: (d, t, ty, c) => {
        if (model && d === cur.d && t === cur.t && ty === cur.type && c === cur.c) return;
        cur = { d, t, type: ty, c };
        build();
      },
      reset: () => {
        stopPlay();
        frame(cur.d + 2 * cur.t);
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
      [outer, seam, edge, insul, insulCut, linerSolid, linerPerf, linerSeam, couplingMat, screwMat, gasketMat].forEach((m) => m.dispose());
      [spangle, fiber, perf, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    api.current?.set(diameter, ins, type, connection);
  }, [diameter, ins, type, connection]);

  const radio = "btn-raised btn-raised-sm h-10 rounded-[0.65rem] font-display text-lg leading-none short:h-8";
  const label = "text-[11px] font-medium tracking-wide text-muted uppercase";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]" role="dialog" aria-modal="true" aria-label="3D model: double wall round spiral pipe">
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Double Wall Spiral Pipe · {TYPE_LABEL[type]}</p>
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
        {hint && !failed && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs font-medium text-steel">Drag to turn · pinch to zoom</p>}
        {!failed &&
          (connection !== "none" ? (
            <div
              className="pointer-events-none absolute inset-x-3 bottom-3 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:inset-x-auto short:top-3 short:bottom-auto short:left-3 short:py-1"
              aria-live="polite"
              data-testid="connection-caption"
              data-step={step}
            >
              <p className="font-display text-lg leading-tight text-accent">{STEPS[connection][step]?.title}</p>
              <p className="text-xs leading-snug text-ink short:hidden">{STEPS[connection][step]?.text}</p>
            </div>
          ) : (
            // Layer key for the cutaway.
            <ul
              className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-2.5 py-1.5 text-xs leading-tight text-ink shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:top-3 short:bottom-auto"
              aria-label="Layers"
              data-testid="layer-key"
            >
              <li className="flex items-center gap-1.5">
                <span className="size-3 shrink-0 rounded-sm bg-[#c9d0d7] ring-1 ring-[#7d8b99]" />
                <span>
                  <b className="font-semibold">Outer shell</b> · solid · {od}&Prime; OD*
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 shrink-0 rounded-sm bg-[#e6c45e] ring-1 ring-[#a88a2e]" />
                <span>
                  <b className="font-semibold">Insulation</b> · {ins}&Prime; fiberglass, 1-1/2 lb
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="size-3 shrink-0 rounded-sm ring-1 ring-[#7d8b99]"
                  style={{ background: type === "sp" ? "radial-gradient(circle, #5b6876 28%, #e3e7eb 32%) 0 0 / 6px 6px" : "#e3e7eb" }}
                />
                <span>
                  <b className="font-semibold">Inner liner</b> · {type === "sp" ? "perforated" : "solid"} · {diameter}&Prime; ID
                </span>
              </li>
            </ul>
          ))}
      </div>
      <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2 short:pt-1">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Shells: outer / inner">
          <span className={`${label} col-span-2 -mb-1`}>Shells · outer / inner</span>
          {(["ss", "sp"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={radio}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Connection">
          <span className={`${label} col-span-3 -mb-1`}>Connection</span>
          {(["none", "coupling", "flange"] as const).map((c) => (
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
      <div className="flex items-center gap-1.5 bg-surface/90 px-3 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <label className="flex w-[5.5rem] shrink-0 flex-col">
          <span className={label}>Inside Ø</span>
          <select value={diameter} onChange={(e) => setDiameter(Number(e.target.value))} className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-2 font-display text-lg" aria-label="Inner diameter">
            {STOCK_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}&Prime; ID
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1 text-[11px] leading-snug whitespace-nowrap text-ink" data-testid="dw-readout">
          <p className="truncate">
            <b className="font-semibold">
              {diameter}&Prime; ID · {od}&Prime; OD*
            </b>
          </p>
          <p className="truncate">
            {gOuter} ga outer · {gLiner} liner*
          </p>
          <p className="truncate text-muted">{connection === "none" ? "* assumed · 4′ shown" : "* assumed · joint shown"}</p>
        </div>
        <button type="button" onClick={() => api.current?.reset()} className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]" aria-label="Reset view">
          <RotateCcw className="size-5" />
        </button>
      </div>
    </div>
  );
}
