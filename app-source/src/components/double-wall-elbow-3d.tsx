import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { HomeButton } from "@/components/home-button";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildFlangeScrews, JOIN_LENGTH, shell, type BuiltConnection } from "@/components/duct-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";
import { buildCollar, buildVanes, centerline, COLLAR, CRIMP_TAPER, CRIMP_X, crimpScrews, JointLoop, miter, MITER_LEG, miterLeg, MiterLoop, piece, tangent, TEX_LENGTH, vaneSpec, VANES_FROM, type Mats } from "@/components/gored-elbow-3d";
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
  ringSector,
  SCREW_TURNS,
  segsFor,
  STEP_PAUSE_MS,
  type DwMats,
} from "@/components/double-wall-pipe-3d";
import { DW_ELBOW_3D_HASH, DW_ELBOW_TYPES, DW_INS, DW_MITER_3D_HASH, DW_MITER_TYPES, dwElbowHash, dwMiterHash, type DwElbowConn, type DwElbowType, type DwIns, type DwMiterType } from "@/lib/route";
import { dwFittingGauge, STOCK_DIAMETERS } from "@/lib/sheets";

/*
 * Interactive 3D model of the double wall round gored elbows (Double Wall Fittings > Round, Brent's Gored Elbows sheet): DE90 90°
 * 5-piece, DE60 60° 3-piece, DE45 45° 3-piece and DE30 30° 2-piece. Same gores as the single wall gored elbow
 * (gored-elbow-3d: end gores tangent at the ends of the turn, middle gores at their middle, a raised seam at each
 * joint), drawn twice: the inner liner at the inside diameter A and the outer shell at A + 2 x insulation, with the
 * insulation between (1", 2" or 3"). Fittings always have a solid liner (Brent: no perforated option). Exterior only,
 * no cutaway (Brent: the fittings do not show the cut out). Each end has a 2" outer collar, and the inner collar sticks
 * out 2" past it.
 * Connections (Brent): Slip Joint works as the single wall one, inner first, then outer: a 12" piece of double wall
 * duct, its outer shell pulled back, slides its liner over the elbow's crimped inner collar up to the bead and is
 * screwed; then its outer shell slides over the crimped outer collar up to that bead and is screwed. Flange works as all
 * the other flanges (the double wall pipe's: one flange ring caps each end, gasket between, screws through both).
 * Assumptions (flagged * in the UI): A is the inside diameter, R = 1.5 x A on the centerline; outer = A + 2 x
 * insulation; gauges from sheet 2 (+2" W.G. fittings column, same for liner and shell); both collars crimped for the
 * slip joint; at a flange the liner runs flush to the flange (no 2" stick-out).
 * The same viewer shows the double wall mitered elbows (family "miter", Brent's Mitered Elbows sheet, printed page 5):
 * DMEV90 and DME90, 90° 2-piece mitered elbows (the single wall ME90's legs, drawn twice, outer shell and liner; each leg
 * runs 4" past the inside corner of the outer shell, 2" collars included), DMEV90 with the single wall MEV90's turning
 * vanes inside the liner, counted by A from the sheet's table (8"-9" 2, 10"-14" 3, 15"-19" 4, 20"-60" 5; none under
 * 8"), seen through the open ends (no cutaway); D3P90, a 90° 3-piece elbow (gores as above, R = 1.5 x A); and D3P90H,
 * the same 3-piece elbow with collar B on top, in line with the lower leg, its outer collar ending 5" above the top of
 * the elbow (sheet). Assumed for D3P90H (*): B round and concentric with the lower leg, B up to A (default about 3/4
 * A), the B outlet starting at the lower gore's seam, ends made like the others (B liner + B + 2 x insulation).
 * Units are inches.
 */

type PlayState = "idle" | "playing" | "paused" | "done";
type ScrewItem = NonNullable<BuiltConnection["screws"]>["items"][number];
const DEG = Math.PI / 180;

type Kind = DwElbowType | DwMiterType;
/** gored: gores on R = 1.5 x A; miter: two straight legs on a 45° cut; heel: gored + the B collar on top. */
type Build = "gored" | "miter" | "heel";
const ELBOW: Record<Kind, { angle: number; pieces: number; name: string; short: string; build: Build; vanes?: boolean }> = {
  de90: { angle: 90, pieces: 5, name: "Gored 90° Elbow (DE90)", short: "90° 5-piece", build: "gored" },
  de60: { angle: 60, pieces: 3, name: "Gored 60° Elbow (DE60)", short: "60° 3-piece", build: "gored" },
  de45: { angle: 45, pieces: 3, name: "Gored 45° Elbow (DE45)", short: "45° 3-piece", build: "gored" },
  de30: { angle: 30, pieces: 2, name: "Gored 30° Elbow (DE30)", short: "30° 2-piece", build: "gored" },
  dmev90: { angle: 90, pieces: 2, name: "Mitered 90° Elbow w/ Vanes (DMEV90)", short: "90° 2-piece mitered, vanes", build: "miter", vanes: true },
  dme90: { angle: 90, pieces: 2, name: "Mitered 90° Elbow (DME90)", short: "90° 2-piece mitered", build: "miter" },
  d3p90: { angle: 90, pieces: 3, name: "3-Piece 90° Elbow (D3P90)", short: "90° 3-piece", build: "gored" },
  d3p90h: { angle: 90, pieces: 3, name: "3-Piece 90° Elbow, B on Top (D3P90H)", short: "90° 3-piece, collar B on top", build: "heel" },
};
const HEEL_H = 5; // D3P90H: B's outer collar ends 5" above the top of the elbow (sheet)
/** D3P90H collar B: the stock size nearest under 3/4 A (as drawn), at least the smallest. Assumed. */
export function defaultB(a: number): number {
  return [...STOCK_DIAMETERS].reverse().find((d) => d <= a * 0.75) ?? STOCK_DIAMETERS[0];
}
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
  liner: THREE.Material; // liner gores (solid, gore UVs)
  collar: Mats; // inner collars (solid)
  insul: THREE.Material;
  insulCut: THREE.Material;
  flange: THREE.Material;
  vane: THREE.Material; // DMEV90 turning vanes
  vaneEdge: THREE.Material;
};

/**
 * One open end, in its end frame (+X out): None / Slip Joint: outer collar x = -4..-2 (beaded / crimped), inner
 * collar -2..0 (plain / crimped) with the liner carried on through the outer collar, insulation face at x = -2.
 * Flange: both collars plain, x = -2..0, capped by the flange ring at the face (x = -FLANGE_T..0). A = liner size.
 */
function buildEnd(f: THREE.Group, A: number, t: number, conn: DwElbowConn, m: ElbowMats) {
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const bead = Math.min(0.34, 0.04 + OD * 0.012) * 0.8;
  const ib = Math.min(0.34, 0.04 + A * 0.012) * 0.8;
  if (conn === "flange") {
    const oc = buildCollar(OD, "plain", m.outer, bead, radial);
    oc.position.x = -FLANGE_T;
    const ic = buildCollar(A, "plain", m.collar, ib, radial);
    ic.position.x = -FLANGE_T;
    f.add(oc, ic, flatRing(ri - drawWall(OD) * 0.5, ro + (OD <= 12 ? 1.25 : 1.5), -FLANGE_T, 0, segsFor(OD), m.flange, true));
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
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * The elbow: outer shell and (solid) liner, the joint seams, and its ends (end frames as the single wall elbows: end 0
 * at (R, 0) pointing down, end 1 at the end of the turn; D3P90H adds end 2, collar B, pointing up).
 * Gored (DE, D3P90, D3P90H): gores on R = 1.5 x A. Mitered (DMEV90 / DME90): two straight legs meeting on the 45° cut
 * at the corner (R, R), R = the outer shell's radius + 4" - 2" (each leg runs to its outer collar, which ends 4" past
 * the other leg's outer wall), and the vanes (DMEV90) inside the liner.
 */
function buildDwElbow(A: number, t: number, kind: Kind, conn: DwElbowConn, m: ElbowMats, B: number) {
  const group = new THREE.Group();
  const { angle, pieces, build, vanes } = ELBOW[kind];
  const theta = angle * DEG;
  const ri = A / 2;
  const ro = ri + t;
  const OD = A + 2 * t;
  const radial = Math.min(144, 64 + Math.round(OD * 4));
  const rib = Math.min(0.34, 0.04 + OD * 0.012);
  let R: number;
  if (build === "miter") {
    R = ro + MITER_LEG - COLLAR;
    const body = new THREE.Group();
    body.position.set(R, R, 0);
    group.add(body);
    const legs = [
      { dir: new THREE.Vector3(0, -1, 0), perp: new THREE.Vector3(1, 0, 0) },
      { dir: new THREE.Vector3(-1, 0, 0), perp: new THREE.Vector3(0, 1, 0) },
    ];
    legs.forEach(({ dir, perp }, i) => {
      body.add(new THREE.Mesh(miterLeg(dir, perp, ro, R, COLLAR * 2 + i * 37, radial), m.outer.metal));
      body.add(new THREE.Mesh(miterLeg(dir, perp, ri, R, COLLAR * 2 + i * 37, radial), m.liner));
    });
    // Seam along the 45° cut (outer shell), raised a little proud, as the single wall ME90.
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new MiterLoop(ro + rib * 0.35), radial, rib, 8, true), m.outer.seam));
    const n = vanes ? (vaneSpec(A)?.n ?? 0) : 0;
    if (n > 0) body.add(buildVanes(A, n, m.vane, m.vaneEdge));
  } else {
    R = R_FACTOR * A;
    const seams = seamsFor(angle, pieces);
    const last = seams.length - 2;
    const tangents = seams.slice(0, -1).map((a, k) => (k === 0 ? 0 : k === last ? theta : (a + seams[k + 1]) / 2));
    let vBase = COLLAR * 2;
    tangents.forEach((tk, k) => {
      const a0 = seams[k];
      const a1 = seams[k + 1];
      const gore = (rr: number, mat: THREE.Material) => group.add(new THREE.Mesh(piece(tk, R, rr, miter(tk, a0, R, rr), miter(tk, a1, R, rr), vBase, radial), mat));
      gore(ro, m.outer.metal);
      gore(ri, m.liner);
      vBase += 2 * R * Math.tan((a1 - a0) / 2) + 3;
    });
    for (let k = 1; k < seams.length - 1; k++) {
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new JointLoop(tangents[k - 1], seams[k], R, ro + rib * 0.35), radial, rib, 8, true), m.outer.seam));
    }
    if (build === "heel") {
      // Collar B straight up from the lower gore's seam, on the lower leg's axis (x = R), to where its 2" outer collar starts.
      const yB = R + ro + HEEL_H - COLLAR;
      const bRadial = Math.min(144, 64 + Math.round((B + 2 * t) * 4));
      for (const [rr, mat] of [[B / 2 + t, m.outer.metal], [B / 2, m.liner]] as const) {
        group.add(new THREE.Mesh(piece(0, R, rr, miter(0, seams[1], R, rr), () => yB, 0, bRadial), mat));
      }
    }
  }
  const out = conn === "flange" ? COLLAR : COLLAR + STICK_OUT;
  const frames = [endFrame(0, theta, R, out), endFrame(1, theta, R, out)];
  if (build === "heel") {
    const f = new THREE.Group();
    f.position.set(R, R + ro + HEEL_H - COLLAR + out, 0);
    f.quaternion.setFromUnitVectors(X_AXIS, Y_AXIS);
    frames.push(f);
  }
  frames.forEach((f, i) => {
    buildEnd(f, i === 2 ? B : A, t, conn, m);
    group.add(f);
  });
  return { group, ends: frames, R, OD };
}

export default function DoubleWallElbow3D({
  onClose,
  family = "gored",
  initialType = family === "miter" ? "dmev90" : "de90",
  initialIns = 1,
  initialConn = "slip",
}: {
  onClose: () => void;
  /** gored: DE90 / DE60 / DE45 / DE30 (sheet 1); miter: DMEV90 / DME90 / D3P90 / D3P90H (sheet 2). */
  family?: "gored" | "miter";
  initialType?: Kind;
  initialIns?: DwIns;
  initialConn?: DwElbowConn;
}) {
  const host = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const api = useRef<{
    set: (d: number, t: DwIns, kind: Kind, c: DwElbowConn, b: number) => void;
    setTopInset: (px: number) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [diameter, setDiameter] = useState(12);
  const [kind, setKind] = useState<Kind>(initialType);
  const [bDia, setBDia] = useState(() => defaultB(12));
  const [ins, setIns] = useState<DwIns>(initialIns);
  const [connection, setConnection] = useState<DwElbowConn>(initialConn);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const od = diameter + 2 * ins;
  const gauge = dwFittingGauge(diameter);
  const spec = ELBOW[kind];
  const types: readonly Kind[] = family === "miter" ? DW_MITER_TYPES : DW_ELBOW_TYPES;
  const vanes = spec.vanes ? vaneSpec(diameter) : null;

  // Follow a deep link change (back / forward).
  useEffect(() => setKind(initialType), [initialType]);
  useEffect(() => setIns(initialIns), [initialIns]);
  useEffect(() => setConnection(initialConn), [initialConn]);
  // Keep the address on what is shown (replace, so the back button still closes the model).
  useEffect(() => {
    if (family === "miter") {
      if (location.hash.startsWith(DW_MITER_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwMiterHash(kind as DwMiterType, ins, connection));
    } else if (location.hash.startsWith(DW_ELBOW_3D_HASH)) history.replaceState(history.state, "", location.pathname + location.search + dwElbowHash(kind as DwElbowType, ins, connection));
  }, [family, kind, ins, connection]);

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
    const metalE = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangleE, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95 });
    const seamE = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const insideE = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.7, roughness: 0.5, side: THREE.BackSide, envMapIntensity: 0.6 });
    const collarE = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangleE, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85 });
    const linerE = new THREE.MeshStandardMaterial({ color: 0xb4bcc4, map: spangleE, metalness: 0.75, roughness: 0.45, envMapIntensity: 0.7, side: THREE.DoubleSide });
    // Duct piece: the double wall pipe's materials (UVs in inches).
    const spangle = spangleTexture();
    spangle.repeat.set(1 / 10, 1 / 10);
    const fiber = fiberTexture();
    const outer = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spangle, metalness: 0.82, roughness: 0.36, envMapIntensity: 0.95, side: THREE.DoubleSide });
    const seam = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.3, side: THREE.DoubleSide });
    const insul = new THREE.MeshStandardMaterial({ color: 0xf0b640, map: fiber, metalness: 0, roughness: 0.95, envMapIntensity: 0.55, side: THREE.DoubleSide });
    const insulCut = new THREE.MeshStandardMaterial({ color: 0xd9962a, map: fiber, metalness: 0, roughness: 1, envMapIntensity: 0.45, side: THREE.DoubleSide });
    const linerSolid = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, map: spangle, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.85, side: THREE.DoubleSide });
    const linerSeam = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.85, roughness: 0.35 });
    const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.8, roughness: 0.24, envMapIntensity: 1.25, side: THREE.DoubleSide });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4, side: THREE.DoubleSide });
    // DMEV90 turning vanes: the single wall MEV90's.
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, map: spangleE, metalness: 0.5, roughness: 0.42, envMapIntensity: 1, side: THREE.DoubleSide });
    const vaneEdge = new THREE.MeshStandardMaterial({ color: 0x5f6b77, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8 });
    const allMats = [metalE, seamE, insideE, collarE, linerE, vaneMat, vaneEdge, outer, seam, edge, insul, insulCut, linerSolid, linerSeam, couplingMat, screwMat, gasketMat];

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

    let cur = { d: 12, t: 1 as DwIns, kind: "de90" as Kind, c: "slip" as DwElbowConn, b: defaultB(12) };
    const build = () => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      const { d, t, kind: k, c, b } = cur;
      const OD = d + 2 * t;
      const ri = d / 2;
      const ro = ri + t;
      const w = drawWall(OD);
      const segs = segsFor(OD);
      spangleE.repeat.set(Math.max(2, Math.round((Math.PI * OD) / 10)), TEX_LENGTH / 10);
      const el = buildDwElbow(d, t, k, c, {
        outer: { metal: metalE, inside: insideE, seam: seamE },
        liner: linerE,
        collar: { metal: collarE, inside: insideE, seam: seamE },
        insul,
        insulCut,
        flange: couplingMat,
        vane: vaneMat,
        vaneEdge,
      }, b);
      const ductMats: DwMats = { outer, seam, edge, insul, insulCut, liner: linerSolid, linerSeam };
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
        `3D double wall ${ELBOW[k].name.toLowerCase()}, solid liner, ${d} inch inside, ${t} inch insulation, ${OD} inch outside, ${c === "none" ? "no connection" : c === "slip" ? "slip joint" : "flanged"}. Drag to turn, pinch to zoom.`,
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
      set: (d, t, k, c, b) => {
        if (model && d === cur.d && t === cur.t && k === cur.kind && c === cur.c && (b === cur.b || ELBOW[k].build !== "heel")) return;
        cur = { d, t, kind: k, c, b };
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
      [spangleE, spangle, fiber, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    api.current?.set(diameter, ins, kind, connection, bDia);
  }, [diameter, ins, kind, connection, bDia]);

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
      ? { title: spec.name, text: noneText() }
      : STEPS[connection][step];
  function noneText() {
    const ends = "2″ outer collars, the inner collar 2″ past each.";
    const r = `R = 1.5 × A* = ${R_FACTOR * diameter}″`;
    if (spec.build === "miter") {
      const legs = `Each leg runs 4″ past the inside corner; ${ends}`;
      if (!spec.vanes) return `90° 2-piece mitered elbow, solid liner, no vanes. ${legs}`;
      return vanes
        ? `90° 2-piece mitered elbow, solid liner, ${vanes.n} turning vanes (${vanes.range}): look in the open end. ${legs}`
        : `90° 2-piece mitered elbow, solid liner. No vanes under ${VANES_FROM}″ (the sheet's table starts at ${VANES_FROM}″*). ${legs}`;
    }
    if (spec.build === "heel") return `${spec.short}, in line with the lower leg, its outer collar 5″ above the elbow; B ${bDia}″*. Solid liner. ${r}; ${ends}`;
    return `${spec.short} ${family === "miter" ? "" : "gored "}elbow, solid liner. ${r}; ${ends}`;
  }
  const radio = "btn-raised btn-raised-sm h-10 rounded-[0.65rem] font-display text-lg leading-none short:h-8";
  const label = "text-[11px] font-medium tracking-wide text-muted uppercase";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]" role="dialog" aria-modal="true" aria-label={`3D model: double wall round ${family === "miter" ? "mitered" : "gored"} elbows`}>
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
          {types.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} aria-label={`${k.toUpperCase()}, ${ELBOW[k].short}`} onClick={() => setKind(k)} className={`${radio} px-0`}>
              {k.toUpperCase()}
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
          <select
            value={diameter}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDiameter(d);
              setBDia(defaultB(d));
            }} className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-2 font-display text-lg" aria-label="Inner diameter">
            {STOCK_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}&Prime; ID
              </option>
            ))}
          </select>
        </label>
        {kind === "d3p90h" && (
          // Collar B: the sheet gives no sizes; any stock size up to A* (default about 3/4 A, as drawn).
          <label className="flex w-[4.25rem] shrink-0 flex-col">
            <span className={label}>B Ø*</span>
            <select value={bDia} onChange={(e) => setBDia(Number(e.target.value))} className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-1.5 font-display text-lg" aria-label="Collar B diameter">
              {STOCK_DIAMETERS.filter((d) => d <= diameter).map((d) => (
                <option key={d} value={d}>
                  {d}&Prime; B
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="min-w-0 flex-1 text-[11px] leading-snug whitespace-nowrap text-ink" data-testid="dw-readout">
          <p className="truncate">
            <b className="font-semibold">
              {kind === "d3p90h" ? "" : <>{diameter}&Prime; ID · </>}
              {od}&Prime; OD*{spec.build === "miter" ? <> · 4&Prime; legs</> : <> · R {R_FACTOR * diameter}&Prime;*</>}
            </b>
          </p>
          <p className="truncate">
            {gauge} ga outer · {gauge} liner*{spec.vanes ? (vanes ? ` · ${vanes.n} vanes` : ` · vanes from ${VANES_FROM}″`) : ""}
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
