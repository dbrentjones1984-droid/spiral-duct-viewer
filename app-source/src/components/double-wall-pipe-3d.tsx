import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { HomeButton } from "@/components/home-button";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCoupling, JOIN_LENGTH, type BuiltConnection } from "@/components/duct-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";
import { DW_INS, DW_ROUND_3D_HASH, dwRoundHash, type DwIns, type DwType } from "@/lib/route";
import { STOCK_DIAMETERS, stockGauge } from "@/lib/sheets";

/*
 * Interactive 3D model of double wall round spiral pipe (Double Wall Duct > Round), from Brent's sheet 1:
 * a solid outer spiral shell, fiberglass insulation (1", 2" or 3", 1-1/2 lb density; 1" standard) and an inner spiral
 * liner, solid (Solid / Solid) or perforated (Solid / Perforated). A cutaway window (outer shell cut back further than
 * the insulation, so the layers step down) shows all three layers. Standard slip joint construction: Play slides an
 * inner coupling into the liners and an outer coupling into the outer shells.
 *
 * Assumptions (not on the sheet, flagged in the UI): outer diameter = inner + 2 x insulation; gauges for both shells
 * from the single wall round chart (by each shell's diameter); perforation 3/32" holes on 3/16" stagger (Double Wall
 * Submittal) drawn 4x larger so they read on a phone; insulation held back 3" from each pipe end for the outer coupling.
 * Units are inches; pipe axis is X.
 */

const SLIDE_MS = 2300;
const SCREW_PAUSE_MS = 200;
const SCREW_MS = 2300;
const SCREW_TURNS = 4;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";
type DwConnection = "none" | "slip";

const SECTION_LENGTH = 48; // 4 ft shown (pipe comes 1 to 20 ft, specify when ordering)
const STRIP_PITCH = 5.6;
/** Cutaway window: around +Z, tipped toward the default camera, so it faces you in both layouts. */
const CUT_A0 = THREE.MathUtils.degToRad(22);
const CUT_A1 = THREE.MathUtils.degToRad(158);
const CUT_OUTER = 13; // outer shell open for |x| < this (main section)
const CUT_STEP = 4; // insulation cut back this much less, so it steps down
const INS_SETBACK = 3; // insulation held back at each pipe end (outer coupling room; assumed)
const PERF_TILE = 0.75; // drawn perforation pitch (real 3/16" stagger, 4x)

/** Part of a cylinder of radius r: x0..x1 along X, angles a0..a1. UVs in inches (u around, v along). */
function cylPatch(r: number, x0: number, x1: number, a0: number, a1: number, segA: number, segX = 1) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segX; i++) {
    const x = x0 + ((x1 - x0) * i) / segX;
    for (let j = 0; j <= segA; j++) {
      const a = a0 + ((a1 - a0) * j) / segA;
      pos.push(x, r * Math.cos(a), r * Math.sin(a));
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
function ringSector(r0: number, r1: number, a0: number, a1: number, x: number, seg: number) {
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

/** Helix rib (lock seam) at radius r, drawn only outside the window (runs split where the shell is cut away). */
function seamRuns(r: number, L: number, phase: number, tubeR: number, hole: ((x: number, a: number) => boolean) | null) {
  const geos: THREE.BufferGeometry[] = [];
  const seamL = L - tubeR * 4;
  const n = Math.max(8, Math.round((seamL / STRIP_PITCH) * 72));
  let run: THREE.Vector3[] = [];
  const flush = () => {
    if (run.length >= 3) geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length * 2, tubeR, 6, false));
    run = [];
  };
  for (let i = 0; i <= n; i++) {
    const x = -seamL / 2 + (seamL * i) / n;
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

type DwMats = { outer: THREE.Material; seam: THREE.Material; edge: THREE.Material; insul: THREE.Material; insulCut: THREE.Material; liner: THREE.Material; linerSeam: THREE.Material };

/** Wall thickness as drawn (a little thicker than real so the cut edges read). */
const drawWall = (d: number) => Math.max(0.06, d * 0.006);

/**
 * One double wall pipe section, centred on x = 0. cut: the cutaway window (main section only).
 * ID = inner liner diameter, t = insulation thickness; outer shell radius = ID / 2 + t.
 */
function buildDoubleWall(ID: number, t: number, m: DwMats, L: number, cut: boolean) {
  const group = new THREE.Group();
  const ri = ID / 2;
  const ro = ri + t;
  const w = drawWall(ID + 2 * t);
  const segFull = Math.min(180, 72 + Math.round((ID + 2 * t) * 3));
  const segCut = Math.round((segFull * (CUT_A1 - CUT_A0)) / (Math.PI * 2));
  const segRest = segFull - segCut;
  const half = L / 2;
  const xo = cut ? CUT_OUTER : 0; // outer window half-length
  const xi = cut ? CUT_OUTER - CUT_STEP : 0; // insulation window half-length
  const add = (g: THREE.BufferGeometry, mat: THREE.Material) => group.add(new THREE.Mesh(g, mat));

  // ---- Outer shell (solid): full tube outside the window, open over CUT_A0..CUT_A1 inside it.
  if (cut) {
    add(cylPatch(ro, -half, -xo, 0, Math.PI * 2, segFull), m.outer);
    add(cylPatch(ro, xo, half, 0, Math.PI * 2, segFull), m.outer);
    add(cylPatch(ro, -xo, xo, CUT_A1, CUT_A0 + Math.PI * 2, segRest, 4), m.outer);
    // Cut edges of the outer shell (bright, so the sheet thickness reads).
    for (const a of [CUT_A0, CUT_A1]) add(radialFace(ro - w, ro, -xo, xo, a), m.edge);
    for (const x of [-xo, xo]) add(ringSector(ro - w, ro, CUT_A0, CUT_A1, x, segCut), m.edge);
  } else {
    add(cylPatch(ro, -half, half, 0, Math.PI * 2, segFull), m.outer);
  }
  for (const x of [-half, half]) add(ringSector(ro - w, ro + 0.005, 0, Math.PI * 2, x, segFull), m.edge);
  const rib = Math.min(0.2, 0.09 + (ID + 2 * t) * 0.004);
  const outerHole = cut ? (x: number, a: number) => Math.abs(x) < xo + rib && a > CUT_A0 - rib / ro && a < CUT_A1 + rib / ro : null;
  for (const g of seamRuns(ro + rib * 0.15, L, 0, rib, outerHole)) add(g, m.seam);
  for (const g of seamRuns(ro + rib * 0.05, L, (rib * 2.1) / ro, rib * 0.75, outerHole)) add(g, m.seam);

  // ---- Insulation (fiberglass), held back from both ends; window cut a little shorter than the outer shell.
  const ia = ri + w * 0.6; // inner face (just outside the liner)
  const ib = ro - w; // outer face (inside the outer shell)
  const ie = half - INS_SETBACK;
  if (cut) {
    add(cylPatch(ib, -ie, -xi, 0, Math.PI * 2, segFull), m.insul);
    add(cylPatch(ib, xi, ie, 0, Math.PI * 2, segFull), m.insul);
    add(cylPatch(ib, -xi, xi, CUT_A1, CUT_A0 + Math.PI * 2, segRest, 4), m.insul);
    add(cylPatch(ia, -ie, -xi, 0, Math.PI * 2, segFull), m.insul);
    add(cylPatch(ia, xi, ie, 0, Math.PI * 2, segFull), m.insul);
    add(cylPatch(ia, -xi, xi, CUT_A1, CUT_A0 + Math.PI * 2, segRest, 4), m.insul);
    for (const a of [CUT_A0, CUT_A1]) add(radialFace(ia, ib, -xi, xi, a), m.insulCut);
    for (const x of [-xi, xi]) add(ringSector(ia, ib, CUT_A0, CUT_A1, x, segCut), m.insulCut);
  } else {
    add(cylPatch(ib, -ie, ie, 0, Math.PI * 2, segFull), m.insul);
    add(cylPatch(ia, -ie, ie, 0, Math.PI * 2, segFull, 2), m.insul);
  }
  for (const x of [-ie, ie]) add(ringSector(ia, ib, 0, Math.PI * 2, x, segFull), m.insulCut);

  // ---- Inner liner (solid or perforated): full length, both sides drawn, with its own lock seam.
  add(cylPatch(ri, -half, half, 0, Math.PI * 2, segFull, 2), m.liner);
  for (const x of [-half, half]) add(ringSector(ri - w * 0.5, ri + w * 0.5, 0, Math.PI * 2, x, segFull), m.edge);
  const lrib = rib * 0.55;
  for (const g of seamRuns(ri + lrib * 0.4, L, 0.6, lrib, null)) add(g, m.linerSeam);
  return group;
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

/** Perforation alpha map: staggered round holes (black = hole) on a square tile, one in the middle, quarters in the corners. */
function perfTexture() {
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
function fiberTexture() {
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

const TYPE_LABEL: Record<DwType, string> = { ss: "Solid / Solid", sp: "Solid / Perforated" };

export default function DoubleWallPipe3D({ onClose, initialType = "ss", initialIns = 1 }: { onClose: () => void; initialType?: DwType; initialIns?: DwIns }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    set: (d: number, t: DwIns, type: DwType, c: DwConnection) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [diameter, setDiameter] = useState(12);
  const [type, setType] = useState<DwType>(initialType);
  const [ins, setIns] = useState<DwIns>(initialIns);
  const [connection, setConnection] = useState<DwConnection>("none");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const od = diameter + 2 * ins;
  const gOuter = stockGauge(od).pipe;
  const gLiner = stockGauge(diameter).pipe;

  // Follow a deep link change (back / forward) to another type or insulation.
  useEffect(() => setType(initialType), [initialType]);
  useEffect(() => setIns(initialIns), [initialIns]);
  // Keep the address on the shown type + insulation (replace, so the back button still closes the model).
  useEffect(() => {
    if (location.hash.startsWith(DW_ROUND_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwRoundHash(type, ins));
  }, [type, ins]);

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
    let conn: BuiltConnection | null = null;
    let fitDistance = 100;
    const frame = (d: number) => {
      const upright = camera.aspect < 0.9;
      if (!model) return;
      model.rotation.z = upright ? Math.PI / 2 : 0;
      model.updateMatrixWorld(true);
      if (upright) {
        shadow.scale.set(d * 2.4, d * 2.4, 1);
        shadow.position.set(0, -SECTION_LENGTH / 2 - 0.05, 0);
      } else {
        const box = new THREE.Box3().setFromObject(model);
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
      if (conn) {
        const focus = model.localToWorld(new THREE.Vector3(conn.focusX, 0, 0));
        const dist = conn.focusR / Math.sin(Math.min(vHalf, hHalf));
        const dir = (upright ? new THREE.Vector3(0.55, 0.5, 1) : new THREE.Vector3(1, 0.45, 0.9)).normalize();
        camera.position.copy(focus).addScaledVector(dir, dist);
        controls.target.copy(focus);
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

    let cur = { d: 12, t: 1 as DwIns, type: "ss" as DwType, c: "none" as DwConnection };
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const { d, t, type: ty, c } = cur;
      const OD = d + 2 * t;
      const mats: DwMats = { outer, seam, edge, insul, insulCut, liner: ty === "sp" ? linerPerf : linerSolid, linerSeam };
      model = new THREE.Group();
      model.add(buildDoubleWall(d, t, mats, SECTION_LENGTH, true));
      if (c === "slip") {
        // Outer coupling in the outer shells, inner coupling in the liners; one 12" double wall piece slides onto both.
        const outerC = buildCoupling(OD, SECTION_LENGTH / 2, couplingMat, 1 / SECTION_LENGTH, screwMat);
        const innerC = buildCoupling(d, SECTION_LENGTH / 2, couplingMat, 1 / SECTION_LENGTH, screwMat);
        conn = outerC;
        model.add(outerC.group, innerC.group);
        const piece = buildDoubleWall(d, t, mats, JOIN_LENGTH, false);
        piece.position.x = outerC.joinStart + JOIN_LENGTH / 2;
        model.add(piece);
        moving = [
          ...outerC.motion.parts.map((m) => ({ ...m, base: m.obj.position.x })),
          ...innerC.motion.parts.map((m) => ({ ...m, base: m.obj.position.x })),
          { obj: piece, base: piece.position.x, ...outerC.motion.piece },
        ];
        screws = outerC.screws?.items ?? [];
        if (outerC.screws) model.add(outerC.screws.group);
      } else {
        conn = null;
        moving = [];
        screws = [];
      }
      stopPlay();
      scene.add(model);
      renderer.domElement.setAttribute(
        "aria-label",
        `3D double wall spiral pipe, ${TYPE_LABEL[ty]}, ${d} inch inside, ${t} inch insulation, ${OD} inch outside, cut away to show the layers. Drag to turn, pinch to zoom.`,
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
      [outer, seam, edge, insul, insulCut, linerSolid, linerPerf, linerSeam, couplingMat, screwMat].forEach((m) => m.dispose());
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
          (connection === "slip" ? (
            <div
              className="pointer-events-none absolute inset-x-3 bottom-3 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:inset-x-auto short:top-3 short:bottom-auto short:left-3 short:py-1"
              aria-live="polite"
              data-testid="connection-caption"
            >
              <p className="font-display text-lg leading-tight text-accent">Slip joint (inner / outer couplings)</p>
              <p className="text-xs leading-snug text-ink short:hidden">
                Standard construction. An inner coupling slides into both liners and an outer coupling into both outer shells (insulation held back 3&Prime; at the ends, assumed); screws through the outer shell. Shown pulled apart.
              </p>
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
        <div className="mt-2 grid grid-cols-6 gap-2">
          <div className="col-span-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Insulation thickness">
            <span className={`${label} col-span-3 -mb-1`}>Insulation</span>
            {DW_INS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={ins === t} aria-label={`${t} inch insulation`} onClick={() => setIns(t)} className={`${radio} px-0`}>
                {t}&Prime;
              </button>
            ))}
          </div>
          <div className="col-span-3 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Connection">
            <span className={`${label} col-span-2 -mb-1`}>Connection</span>
            <button type="button" role="radio" aria-checked={connection === "none"} onClick={() => setConnection("none")} className={`${radio} px-0`}>
              None
            </button>
            <button type="button" role="radio" aria-checked={connection === "slip"} aria-label="Slip joint" onClick={() => setConnection("slip")} className={`${radio} px-0`}>
              Slip
            </button>
          </div>
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
          <p className="truncate text-muted">* assumed · 4&prime; shown</p>
        </div>
        {connection === "slip" && !failed ? (
          <button
            type="button"
            onClick={() => api.current?.play()}
            aria-label={play === "playing" ? "Pause" : play === "done" ? "Replay how it goes together" : "Play how it goes together"}
            className="btn-raised btn-raised-sm flex h-11 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-[0.65rem] font-display text-base leading-none"
          >
            {play === "playing" ? <Pause className="size-4" aria-hidden="true" /> : play === "done" ? <RotateCw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {play === "playing" ? "Pause" : play === "done" ? "Replay" : "Play"}
          </button>
        ) : null}
        <button type="button" onClick={() => api.current?.reset()} className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]" aria-label="Reset view">
          <RotateCcw className="size-5" />
        </button>
      </div>
    </div>
  );
}
