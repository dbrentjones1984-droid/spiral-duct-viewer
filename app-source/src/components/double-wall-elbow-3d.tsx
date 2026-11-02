import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { HomeButton } from "@/components/home-button";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildFlangeScrews, JOIN_LENGTH, shell, type BuiltConnection } from "@/components/duct-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";
import { buildCollar, centerline, COLLAR, CRIMP_TAPER, CRIMP_X, crimpScrews, JointLoop, miter, piece, tangent, TEX_LENGTH, type Mats } from "@/components/gored-elbow-3d";
import {
  buildSection,
  disposeGroup,
  drawWall,
  easeInOut,
  fiberTexture,
  FLANGE_APART,
  FLANGE_T,
  flatRing,
  GASKET_T,
  PERF_TILE,
  perfTexture,
  ringSector,
  SCREW_TURNS,
  segsFor,
  STEP_PAUSE_MS,
  TYPE_LABEL,
  type DwMats,
} from "@/components/double-wall-pipe-3d";
import { DW_ELBOW_3D_HASH, DW_ELBOW_TYPES, DW_INS, dwElbowHash, type DwElbowConn, type DwElbowType, type DwIns, type DwType } from "@/lib/route";
import { dwFittingGauge, STOCK_DIAMETERS } from "@/lib/sheets";

/*
 * Interactive 3D model of the double wall round gored elbows (Double Wall Duct > Round, Brent's sheet 4): DE90 90°
 * 5-piece, DE60 60° 3-piece, DE45 45° 3-piece and DE30 30° 2-piece. Same gores as the single wall gored elbow
 * (gored-elbow-3d: end gores tangent at the ends of the turn, middle gores at their middle, a raised seam at each
 * joint), drawn twice: the inner liner at the inside diameter A and the outer shell at A + 2 x insulation, with the
 * insulation between (1", 2" or 3"; Solid / Solid or Solid / Perforated liner, as the double wall pipe). Exterior only,
 * no cutaway (Brent: the fittings do not show the cut out). Each end has a 2" outer collar, and the inner collar sticks
 * out 2" past it.
 * Connections (Brent): Slip Joint works as the single wall one, inner first, then outer: a 12" piece of double wall
 * duct, its outer shell pulled back, slides its liner over the elbow's crimped inner collar up to the bead and is
 * screwed; then its outer shell slides over the crimped outer collar up to that bead and is screwed. Flange works as all
 * the other flanges (the double wall pipe's: one flange ring caps each end, gasket between, screws through both).
 * Assumptions (flagged * in the UI): A is the inside diameter, R = 1.5 x A on the centerline; outer = A + 2 x
 * insulation; gauges from sheet 2 (+2" W.G. fittings column, same for liner and shell); both collars crimped for the
 * slip joint, the collars solid on a perforated elbow; at a flange the liner runs flush to the flange (no 2" stick-out).
 * Units are inches.
 */

type PlayState = "idle" | "playing" | "paused" | "done";
type ScrewItem = NonNullable<BuiltConnection["screws"]>["items"][number];
const DEG = Math.PI / 180;

const ELBOW: Record<DwElbowType, { angle: number; pieces: number; name: string; short: string }> = {
  de90: { angle: 90, pieces: 5, name: "Gored 90° Elbow (DE90)", short: "90° 5-piece" },
  de60: { angle: 60, pieces: 3, name: "Gored 60° Elbow (DE60)", short: "60° 3-piece" },
  de45: { angle: 45, pieces: 3, name: "Gored 45° Elbow (DE45)", short: "45° 3-piece" },
  de30: { angle: 30, pieces: 2, name: "Gored 30° Elbow (DE30)", short: "30° 2-piece" },
};
const CONN_LABEL: Record<DwElbowConn, string> = { none: "None", slip: "Slip Joint", flange: "Flange" };
const R_FACTOR = 1.5; // sheet 4: R = 1.5 x A
const STICK_OUT = 2; // inner collar past the outer collar (Brent)

/** Play captions (0 = shown apart, before Play; then one per step; the last when assembled). * = assumed. */
const STEPS: Record<Exclude<DwElbowConn, "none">, { title: string; text: string }[]> = {
  slip: [
    { title: "Slip Joint · inner, then outer", text: "Shown apart: the elbow's inner collar sticks out 2″ past its outer collar, both crimped. The duct's outer shell* is pulled back. Press Play." },
    { title: "1 · Inner connects", text: "The duct's inner liner slides over the elbow's crimped inner collar, up to its bead." },
    { title: "2 · Screw the inner", text: "Screws go through the duct liner into the elbow's inner collar." },
    { title: "3 · Outer closes", text: "The duct's outer shell slides over the elbow's crimped outer collar*, up to its bead." },
    { title: "4 · Screw the outer", text: "Screws go through the outer shell into the elbow's outer collar." },
    { title: "Assembled", text: "Same as the single wall slip joint: the inner connects first, then the outer. * assumed" },
  ],
  flange: [
    { title: "Flange · each end capped", text: "Shown apart. The elbow end and the duct end are each capped by one flange ring (outer shell and liner run out to it*); gasket between. Press Play." },
    { title: "1 · Flanges together", text: "The ends meet flange face to face on the gasket." },
    { title: "2 · Screw the flanges", text: "Screws go through both flanges and the gasket." },
    { title: "Assembled", text: "Same as the other flanges: one flange per end, gasket, screws. * assumed" },
  ],
};

/** Gore joints for an elbow of `angle` degrees in `n` pieces: half pieces at the ends, full ones between. */
function seamsFor(angle: number, n: number) {
  const full = angle / (n - 1);
  const s = [0];
  for (let k = 0; k < n - 1; k++) s.push(full / 2 + k * full);
  s.push(angle);
  return s.map((a) => a * DEG);
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
/** Local frame at one end (as gored-elbow-3d endFrame, for any angle): +X out along the axis, origin `out` past the gore. */
function endFrame(end: 0 | 1, theta: number, R: number, out: number) {
  const t = end === 0 ? 0 : theta;
  const dir = tangent(t).multiplyScalar(end === 0 ? -1 : 1);
  const g = new THREE.Group();
  g.position.copy(centerline(t, R)).addScaledVector(dir, out);
  g.quaternion.setFromUnitVectors(X_AXIS, dir);
  return g;
}

type ElbowMats = {
  outer: Mats; // outer shell + outer collars: metal, inside, seam (gore UVs)
  liner: THREE.Material; // liner gores (solid or perforated, gore UVs)
  collar: Mats; // inner collars (solid)
  insul: THREE.Material;
  insulCut: THREE.Material;
  flange: THREE.Material;
};

/**
 * The elbow: outer gores (with the joint seams) and the liner gores, the insulation's inner face behind a perforated
 * liner, and the two ends. Ends (end frame): None / Slip Joint: outer collar x = -4..-2 (beaded / crimped), inner
 * collar -2..0 (plain / crimped) with the liner carried on through the outer collar, insulation face at x = -2.
 * Flange: both collars plain, x = -2..0, capped by the flange ring at the face (x = -FLANGE_T..0).
 */
function buildDwElbow(A: number, t: number, kind: DwElbowType, conn: DwElbowConn, perf: boolean, m: ElbowMats) {
  const group = new THREE.Group();
  const { angle, pieces } = ELBOW[kind];
  const theta = angle * DEG;
  const seams = seamsFor(angle, pieces);
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const R = R_FACTOR * A;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const rib = Math.min(0.34, 0.04 + OD * 0.012);
  const bead = rib * 0.8;
  const w = drawWall(OD);
  const last = seams.length - 2;
  const tangents = seams.slice(0, -1).map((a, k) => (k === 0 ? 0 : k === last ? theta : (a + seams[k + 1]) / 2));
  let vBase = COLLAR * 2;
  tangents.forEach((tk, k) => {
    const a0 = seams[k];
    const a1 = seams[k + 1];
    const gore = (rr: number, mat: THREE.Material) => group.add(new THREE.Mesh(piece(tk, R, rr, miter(tk, a0, R, rr), miter(tk, a1, R, rr), vBase, radial), mat));
    gore(ro, m.outer.metal);
    gore(ri, m.liner);
    if (perf) gore(ri + w * 0.6, m.insul); // seen through the perforations
    vBase += 2 * R * Math.tan((a1 - a0) / 2) + 3;
  });
  for (let k = 1; k < seams.length - 1; k++) {
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new JointLoop(tangents[k - 1], seams[k], R, ro + rib * 0.35), radial, rib, 8, true), m.outer.seam));
  }
  const flanged = conn === "flange";
  const ends = ([0, 1] as const).map((e) => {
    const f = endFrame(e, theta, R, flanged ? COLLAR : COLLAR + STICK_OUT);
    const ib = Math.min(0.34, 0.04 + A * 0.012) * 0.8;
    if (flanged) {
      const oc = buildCollar(OD, "plain", m.outer, bead, radial);
      oc.position.x = -FLANGE_T;
      const ic = buildCollar(A, "plain", m.collar, ib, radial);
      ic.position.x = -FLANGE_T;
      f.add(oc, ic, flatRing(ri - w * 0.5, ro + (OD <= 12 ? 1.25 : 1.5), -FLANGE_T, 0, segsFor(OD), m.flange, true));
    } else {
      const slip = conn === "slip";
      const oc = buildCollar(OD, slip ? "crimp" : "bead", m.outer, bead, radial);
      oc.position.x = -STICK_OUT;
      const ic = buildCollar(A, slip ? "crimp" : "plain", m.collar, ib, radial);
      f.add(oc, ic);
      // Liner on through the outer collar (inside face), and the insulation's face where the outer collar ends.
      const wall = Math.max(0.05, A * 0.006);
      f.add(new THREE.Mesh(shell([-STICK_OUT - COLLAR, -STICK_OUT], radial, () => ri - wall, 1 / TEX_LENGTH), m.collar.inside));
      const owall = Math.max(0.05, OD * 0.006);
      const rIns = slip ? ro - owall - 0.05 - owall - 0.1 - OD * 0.003 : ro - owall;
      f.add(new THREE.Mesh(ringSector(ri + 0.01, rIns, 0, Math.PI * 2, -STICK_OUT - 0.03, radial), m.insulCut));
    }
    group.add(f);
    return f;
  });
  return { group, ends, R, OD };
}

export default function DoubleWallElbow3D({
  onClose,
  initialType = "de90",
  initialShells = "ss",
  initialIns = 1,
  initialConn = "slip",
}: {
  onClose: () => void;
  initialType?: DwElbowType;
  initialShells?: DwType;
  initialIns?: DwIns;
  initialConn?: DwElbowConn;
}) {
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    set: (d: number, t: DwIns, shells: DwType, kind: DwElbowType, c: DwElbowConn) => void;
    setTopInset: (px: number) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [diameter, setDiameter] = useState(12);
  const [kind, setKind] = useState<DwElbowType>(initialType);
  const [shells, setShells] = useState<DwType>(initialShells);
  const [ins, setIns] = useState<DwIns>(initialIns);
  const [connection, setConnection] = useState<DwElbowConn>(initialConn);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const od = diameter + 2 * ins;
  const gauge = dwFittingGauge(diameter);
  const spec = ELBOW[kind];

  // Follow a deep link change (back / forward).
  useEffect(() => setKind(initialType), [initialType]);
  useEffect(() => setShells(initialShells), [initialShells]);
  useEffect(() => setIns(initialIns), [initialIns]);
  useEffect(() => setConnection(initialConn), [initialConn]);
  // Keep the address on what is shown (replace, so the back button still closes the model).
  useEffect(() => {
    if (location.hash.startsWith(DW_ELBOW_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwElbowHash(kind, shells, ins, connection));
  }, [kind, shells, ins, connection]);

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

    // Elbow: the single wall gored elbow's materials (UVs around 0..1, along / TEX_LENGTH).
    const spangleE = spangleTexture();
    const perfE = perfTexture();
    const metalE = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangleE, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95 });
    const seamE = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const insideE = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.7, roughness: 0.5, side: THREE.BackSide, envMapIntensity: 0.6 });
    const collarE = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangleE, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85 });
    const linerE = new THREE.MeshStandardMaterial({ color: 0xb4bcc4, map: spangleE, metalness: 0.75, roughness: 0.45, envMapIntensity: 0.7, side: THREE.DoubleSide });
    const linerEPerf = linerE.clone();
    linerEPerf.alphaMap = perfE;
    linerEPerf.alphaTest = 0.5;
    linerEPerf.alphaToCoverage = true;
    // Duct piece: the double wall pipe's materials (UVs in inches).
    const spangle = spangleTexture();
    spangle.repeat.set(1 / 10, 1 / 10);
    const fiber = fiberTexture();
    const perf = perfTexture();
    const outer = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangle, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95, side: THREE.DoubleSide });
    const seam = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.3, side: THREE.DoubleSide });
    const insul = new THREE.MeshStandardMaterial({ color: 0xf0b640, map: fiber, metalness: 0, roughness: 0.95, envMapIntensity: 0.55, side: THREE.DoubleSide });
    const insulCut = new THREE.MeshStandardMaterial({ color: 0xd9962a, map: fiber, metalness: 0, roughness: 1, envMapIntensity: 0.45, side: THREE.DoubleSide });
    const linerSolid = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangle, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85, side: THREE.DoubleSide });
    const linerPerf = linerSolid.clone();
    linerPerf.alphaMap = perf;
    linerPerf.alphaTest = 0.5;
    linerPerf.alphaToCoverage = true;
    const linerSeam = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.85, roughness: 0.35 });
    const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.8, roughness: 0.24, envMapIntensity: 1.25, side: THREE.DoubleSide });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4, side: THREE.DoubleSide });
    const allMats = [metalE, seamE, insideE, collarE, linerE, linerEPerf, outer, seam, edge, insul, insulCut, linerSolid, linerPerf, linerSeam, couplingMat, screwMat, gasketMat];

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    // Spins like the single wall elbow until you drag.
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

    let model: THREE.Group | null = null;
    const view = new THREE.Vector3(0.3, 0.32, 1);
    // Same framing as the single wall elbow: the whole turning circle stays in view while it spins.
    const frame = (d: number) => {
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
      const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.04 + d / 4;
      camera.position.copy(view.clone().normalize().multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.minDistance = d * 0.9;
      controls.maxDistance = dist * 2.2;
      camera.near = Math.max(0.1, d * 0.05);
      camera.far = dist * 6;
      project();
      controls.update();
    };

    // ---- Play: the double wall pipe's step list (moves along each part's end-frame X, or a set of screws), one
    // caption per step.
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
        for (const mv of st.moves ?? []) off.set(mv.obj, (off.get(mv.obj) ?? 0) + mv.delta * easeInOut(p));
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

    let cur = { d: 12, t: 1 as DwIns, shells: "ss" as DwType, kind: "de90" as DwElbowType, c: "slip" as DwElbowConn };
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const { d, t, shells: sh, kind: k, c } = cur;
      const OD = d + 2 * t;
      const ri = d / 2;
      const ro = ri + t;
      const w = drawWall(OD);
      const segs = segsFor(OD);
      spangleE.repeat.set(Math.max(2, Math.round((Math.PI * OD) / 10)), TEX_LENGTH / 10);
      perfE.repeat.set(Math.max(4, Math.round((Math.PI * d) / PERF_TILE)), TEX_LENGTH / PERF_TILE);
      const perfOn = sh === "sp";
      const el = buildDwElbow(d, t, k, c, perfOn, {
        outer: { metal: metalE, inside: insideE, seam: seamE },
        liner: perfOn ? linerEPerf : linerE,
        collar: { metal: collarE, inside: insideE, seam: seamE },
        insul,
        insulCut,
        flange: couplingMat,
      });
      const ductMats: DwMats = { outer, seam, edge, insul, insulCut, liner: perfOn ? linerPerf : linerSolid, linerSeam };
      steps = [];
      bases = new Map();
      allScrews = [];
      const pause: Step = { ms: STEP_PAUSE_MS, cap: -1 };
      const move = (obj: THREE.Object3D, delta: number) => {
        if (!bases.has(obj)) bases.set(obj, obj.position.x);
        return { obj, delta };
      };
      // The connection goes on the bottom end (end 0): the duct hangs straight down under the elbow, as on the single wall elbow.
      const f = el.ends[0];
      if (c === "slip") {
        // Duct piece D (its liner end at D's x = 0): 12" liner; its outer shell + insulation (dO) start pulled back.
        // Assembled: the liner end against the inner collar's bead, the outer shell's end against the outer collar's bead.
        const stopI = CRIMP_X - 0.03;
        const stopO = -STICK_OUT + CRIMP_X - 0.03;
        const lead = stopI - stopO; // the duct liner sticks out this far past its outer shell when assembled
        const back = 4; // outer shell pulled back this far (the inner screws show)
        const gap = d <= 8 ? 1.5 : d <= 16 ? 2 : 2.5;
        const D = new THREE.Group();
        D.position.x = gap;
        f.add(D);
        D.add(buildSection(d, t, ductMats, { liner: [0, JOIN_LENGTH], win: [] }));
        const dO = buildSection(d, t, ductMats, { outer: [-lead, JOIN_LENGTH], ins: [0.05, JOIN_LENGTH], win: [] });
        dO.position.x = back;
        D.add(dO);
        const sx = (CRIMP_X + CRIMP_TAPER) / 2 - 0.15; // over the crimp, as the single wall slip joint
        const innerS = crimpScrews(d, sx, screwMat);
        const outerS = crimpScrews(OD, -STICK_OUT + sx, screwMat);
        f.add(innerS.group, outerS.group);
        allScrews = [...innerS.items, ...outerS.items];
        steps = [
          { ms: 2000, cap: 1, moves: [move(D, stopI - gap)] },
          { ...pause, cap: 2 },
          { ms: 2200, cap: 2, screws: innerS.items },
          { ...pause, cap: 3 },
          { ms: 1800, cap: 3, moves: [move(dO, -back)] },
          { ...pause, cap: 4 },
          { ms: 2200, cap: 4, screws: outerS.items },
        ];
      } else if (c === "flange") {
        // As the double wall pipe's flange: the duct piece B capped by its flange ring, gasket between, screws.
        const rf = ro + (OD <= 12 ? 1.25 : 1.5);
        const ft = FLANGE_T;
        const gt = GASKET_T;
        const S = FLANGE_APART;
        const r0 = ri - w * 0.5;
        const B = new THREE.Group();
        B.position.x = S;
        f.add(B);
        const b0 = gt + ft;
        B.add(buildSection(d, t, ductMats, { liner: [b0, b0 + JOIN_LENGTH], outer: [b0, b0 + JOIN_LENGTH], ins: [b0, b0 + JOIN_LENGTH], win: [] }));
        B.add(flatRing(r0, rf, gt, b0, segs, couplingMat, true));
        const gasket = flatRing(r0 + 0.02, rf - 0.03, 0, gt, segs, gasketMat, false);
        gasket.position.x = S / 2;
        f.add(gasket);
        const fS = buildFlangeScrews(OD, (ro + rf) / 2, b0, screwMat);
        f.add(fS.group);
        allScrews = fS.items;
        steps = [
          { ms: 1900, cap: 1, moves: [move(B, -S), move(gasket, -S / 2)] },
          { ...pause, cap: 2 },
          { ms: 2400, cap: 2, screws: fS.items },
        ];
      }
      doneCap = c === "none" ? 0 : STEPS[c].length - 1;
      steps = steps.map((st, i) => (st.cap === -1 ? { ...st, cap: steps[i + 1]?.cap ?? 0 } : st));
      playMs = steps.reduce((sum, st) => sum + st.ms, 0);
      stopPlay();
      // As drawn on the sheet: the bottom end on the left pointing down, the turn going up and to the right.
      const elbow = el.group;
      elbow.rotation.y = Math.PI;
      elbow.updateMatrixWorld(true);
      elbow.position.sub(new THREE.Box3().setFromObject(elbow).getCenter(new THREE.Vector3()));
      model = new THREE.Group();
      model.add(elbow);
      scene.add(model);
      renderer.domElement.setAttribute(
        "aria-label",
        `3D double wall ${ELBOW[k].name.toLowerCase()}, ${TYPE_LABEL[sh]}, ${d} inch inside, ${t} inch insulation, ${OD} inch outside, ${c === "none" ? "no connection" : c === "slip" ? "slip joint" : "flanged"}. Drag to turn, pinch to zoom.`,
      );
      frame(OD);
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
      frame(cur.d + 2 * cur.t);
    });
    ro.observe(el);

    api.current = {
      set: (d, t, sh, k, c) => {
        if (model && d === cur.d && t === cur.t && sh === cur.shells && k === cur.kind && c === cur.c) return;
        cur = { d, t, shells: sh, kind: k, c };
        build();
      },
      setTopInset: (px) => {
        if (Math.abs(px - inset) < 1) return;
        inset = px;
        frame(cur.d + 2 * cur.t);
      },
      reset: () => {
        stopPlay();
        frame(cur.d + 2 * cur.t);
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
      allMats.forEach((m) => m.dispose());
      [spangleE, perfE, spangle, fiber, perf, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    api.current?.set(diameter, ins, shells, kind, connection);
  }, [diameter, ins, shells, kind, connection]);

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

  const info =
    connection === "none"
      ? { title: spec.name, text: `${spec.short} gored elbow, ${TYPE_LABEL[shells].toLowerCase()}. R = 1.5 × A* = ${R_FACTOR * diameter}″; 2″ outer collars, the inner collar 2″ past each.` }
      : STEPS[connection][step];
  const radio = "btn-raised btn-raised-sm h-10 rounded-[0.65rem] font-display text-lg leading-none short:h-8";
  const label = "text-[11px] font-medium tracking-wide text-muted uppercase";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]" role="dialog" aria-modal="true" aria-label="3D model: double wall round gored elbows">
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Double Wall Round · {spec.name}</p>
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
        {!failed && (
          <div
            ref={caption}
            className="pointer-events-none absolute inset-x-3 top-3 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:inset-x-auto short:left-3 short:py-1"
            aria-live="polite"
            data-testid="connection-caption"
            data-step={connection === "none" ? 0 : step}
          >
            <p className="font-display text-lg leading-tight text-accent">{info?.title}</p>
            <p className="text-xs leading-snug text-ink short:hidden">{info?.text}</p>
          </div>
        )}
        {hint && !failed && <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-steel">Drag to turn · pinch to zoom</p>}
      </div>
      <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2 short:pt-1">
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Elbow">
          <span className={`${label} col-span-4 -mb-1`}>Elbow · {spec.short}</span>
          {DW_ELBOW_TYPES.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} aria-label={`${k.toUpperCase()}, ${ELBOW[k].short}`} onClick={() => setKind(k)} className={`${radio} px-0`}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Shells: outer / inner">
          <span className={`${label} col-span-2 -mb-1`}>Shells · outer / inner</span>
          {(["ss", "sp"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={shells === t} onClick={() => setShells(t)} className={radio}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Connection">
          <span className={`${label} col-span-3 -mb-1`}>Connection</span>
          {(["none", "slip", "flange"] as const).map((c) => (
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
              {diameter}&Prime; ID · {od}&Prime; OD* · R {R_FACTOR * diameter}&Prime;*
            </b>
          </p>
          <p className="truncate">
            {gauge} ga outer · {gauge} liner*
          </p>
          <p className="truncate text-muted">* assumed · +2&Prime; W.G. gauges</p>
        </div>
        <button type="button" onClick={() => api.current?.reset()} className="btn-raised btn-raised-sm grid size-11 shrink-0 place-items-center rounded-[0.65rem]" aria-label="Reset view">
          <RotateCcw className="size-5" />
        </button>
      </div>
    </div>
  );
}
