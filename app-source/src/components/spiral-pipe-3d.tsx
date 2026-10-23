import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCoupling, buildFlange, CONNECTION_INFO, CONNECTIONS, JOIN_LENGTH, type BuiltConnection, type Connection } from "@/components/duct-connections";
import { STOCK_DIAMETERS, stockGauge } from "@/lib/sheets";

/*
 * Interactive 3D model of single wall round spiral pipe (Single Wall Duct > Round), based on Brent's sheets:
 * galvanized spiral pipe with a helical lock seam, plain (female) slip-joint ends, stocked in 10'-0" lengths,
 * 3"-24" stock sizes with the sheet-1 gauges. Plain three.js (no React Three Fiber) and loaded only when the
 * "View 3D Model" button is pressed, to keep the main app light. Units are inches.
 */

/** Play (assembly) animation: slide-together time, then (coupling, flange) a short pause and the screw-driving phase, ms. */
const SLIDE_MS = 2300;
const SCREW_PAUSE_MS = 200;
const SCREW_MS = 2300;
const SCREW_TURNS = 4; // spin while driving in
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type PlayState = "idle" | "playing" | "paused" | "done";

const SECTION_LENGTH = 48; // a 4 ft section is shown so small sizes still read as a pipe; stock length is 10'-0"
const STRIP_PITCH = 5.6; // axial advance of the lock seam per turn (~5-1/2" strip)

/** Faint galvanized "spangle": soft irregular light/dark flakes, generated once (no image download). */
function spangleTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c2c8ce";
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 4 + rnd() * 14;
    const shade = 184 + Math.round(rnd() * 40);
    g.fillStyle = `rgba(${shade},${shade + 4},${shade + 8},0.3)`;
    g.beginPath();
    const sides = 5 + Math.floor(rnd() * 3);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + rnd() * 0.5;
      const rr = r * (0.6 + rnd() * 0.5);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft contact shadow under the pipe (radial gradient on a plane; cheaper than real shadows on phones). */
function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(10,25,45,0.42)");
  grad.addColorStop(1, "rgba(10,25,45,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Helix along the pipe axis (X), at a given radius. */
class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private radius: number,
    private length: number,
    private pitch: number,
    private phase = 0,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const x = -this.length / 2 + t * this.length;
    const a = (x / this.pitch) * Math.PI * 2 + this.phase;
    return target.set(x, Math.cos(a) * this.radius, Math.sin(a) * this.radius);
  }
}

/** Scale a cylinder's V texture coordinate so a shorter piece keeps the same spangle size as the 4 ft section. */
function scaleV(g: THREE.BufferGeometry, k: number) {
  if (k === 1) return;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * k);
}

type PipeMats = { metal: THREE.Material; inside: THREE.Material; seam: THREE.Material; rim: THREE.Material };

function buildPipe(diameter: number, { metal, inside, seam: seamMat, rim }: PipeMats, L = SECTION_LENGTH) {
  const group = new THREE.Group();
  const r = diameter / 2;
  const wall = Math.max(0.05, diameter * 0.006); // drawn a little thicker than 26 ga (0.022") so the rim shows
  const radial = Math.min(160, 64 + Math.round(diameter * 4));

  const outer = new THREE.CylinderGeometry(r, r, L, radial, 1, true);
  outer.rotateZ(-Math.PI / 2);
  scaleV(outer, L / SECTION_LENGTH);
  group.add(new THREE.Mesh(outer, metal));

  const inner = new THREE.CylinderGeometry(r - wall, r - wall, L, radial, 1, true);
  inner.rotateZ(-Math.PI / 2);
  group.add(new THREE.Mesh(inner, inside));

  // Lock seam: a raised double rib following the helix (the folded strip edges), plus its flat line inside.
  const turns = L / STRIP_PITCH;
  const segs = Math.round(turns * 72);
  const rib = Math.min(0.2, 0.09 + diameter * 0.004);
  const seamL = L - rib * 4; // stop the seam just inside the cut ends
  const lockA = new THREE.TubeGeometry(new Helix(r + rib * 0.15, seamL, STRIP_PITCH), segs, rib, 8, false);
  const lockB = new THREE.TubeGeometry(new Helix(r + rib * 0.05, seamL, STRIP_PITCH, (rib * 2.1) / r), segs, rib * 0.75, 8, false);
  const lockIn = new THREE.TubeGeometry(new Helix(r - wall - 0.01, seamL, STRIP_PITCH, rib / r), segs, rib * 0.4, 6, false);
  group.add(new THREE.Mesh(lockA, seamMat), new THREE.Mesh(lockB, seamMat), new THREE.Mesh(lockIn, inside));

  // Cut ends: thin rims so the open ends read as sheet metal.
  for (const x of [-L / 2, L / 2]) {
    const ring = new THREE.RingGeometry(r - wall, r + 0.005, radial);
    ring.rotateY(Math.PI / 2);
    ring.translate(x, 0, 0);
    group.add(new THREE.Mesh(ring, rim));
  }
  return group;
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

export default function SpiralPipe3D({ onClose }: { onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setDiameter: (d: number) => void;
    setConnection: (c: Connection) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [diameter, setDiameter] = useState(12);
  const [connection, setConnection] = useState<Connection>("none");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);
  const gauge = stockGauge(diameter);

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
    renderer.domElement.setAttribute("aria-label", "3D spiral pipe. Drag to turn, pinch to zoom.");
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
    const seamMat = new THREE.MeshStandardMaterial({ color: 0xd4d9de, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.05 });
    const inside = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.7, roughness: 0.5, side: THREE.BackSide, envMapIntensity: 0.6 });
    const sheet = metal.clone(); // same galvanized finish, both sides (thin coupling / collar seen from inside too)
    sheet.side = THREE.DoubleSide;
    // Coupling: a touch brighter and smoother than the pipe so the sleeve reads as its own part at the joint.
    const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.8, roughness: 0.24, envMapIntensity: 1.25, side: THREE.DoubleSide });
    // Sheet-metal screws (darker steel than the pipe so they stand out), driven in around the coupling joint at the end of Play.
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x6f7a86, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    // Flange gasket: dark matte black rubber.
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0, roughness: 0.92, envMapIntensity: 0.4 });
    const solidPipe: PipeMats = { metal, inside, seam: seamMat, rim: metal };

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
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

    // model = pipe (+ connection); rotated as a whole for portrait screens.
    let model: THREE.Group | null = null;
    let conn: BuiltConnection | null = null;
    let fitDistance = 100;
    const frame = (d: number) => {
      // Portrait phones: stand the pipe up (shows the open end and fills the tall screen); wide screens: lay it down.
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
      // Fit the pipe's on-screen box (long side x diameter) with a margin.
      const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const along = SECTION_LENGTH / 2 + d * 0.3;
      const across = d / 2 + d * 0.15;
      const halfH = upright ? along : across + SECTION_LENGTH * 0.12;
      const halfW = upright ? across : along * 0.92;
      fitDistance = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.12 + d / 2;
      if (conn) {
        // Zoom to the connection end, seen from a little above so the open end (crimps / ring face) reads.
        const focus = model.localToWorld(new THREE.Vector3(conn.focusX, 0, 0));
        const dist = conn.focusR / Math.sin(Math.min(vHalf, hHalf));
        const dir = (upright ? new THREE.Vector3(0.55, 0.5, 1) : new THREE.Vector3(1, 0.45, 0.9)).normalize();
        camera.position.copy(focus).addScaledVector(dir, dist);
        controls.target.copy(focus);
      } else {
        const dir = (upright ? new THREE.Vector3(0.5, 0.36, 1) : new THREE.Vector3(0.55, 0.42, 1)).normalize();
        camera.position.copy(dir.multiplyScalar(fitDistance));
        controls.target.set(0, 0, 0);
      }
      controls.minDistance = d * 0.9;
      controls.maxDistance = fitDistance * 2.2;
      camera.near = Math.max(0.1, d * 0.05);
      camera.far = fitDistance * 6;
      camera.updateProjectionMatrix();
      controls.update();
    };
    // ---- Play: slide the parts together (offsets along the pipe axis from each part's static position),
    // then (coupling, flange) drive the screws in. playT is elapsed ms. ----
    let moving: { obj: THREE.Object3D; base: number; from: number; to: number }[] = [];
    let screws: NonNullable<BuiltConnection["screws"]>["items"] = [];
    let playMs = SLIDE_MS;
    let playT = 0;
    let playing = false;
    let lastTime = 0;
    const pose = (t: number | null) => {
      // t = null: the static view (no offsets, no screws); otherwise ms into the assembly.
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
        sc.drive.scale.setScalar(Math.min(1, 0.4 + u * 4)); // quick pop-in as it appears
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

    const build = (d: number, c: Connection) => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      model = new THREE.Group();
      const mats = solidPipe;
      model.add(buildPipe(d, mats));
      const uvScale = 1 / SECTION_LENGTH; // same spangle scale as the pipe
      conn =
        c === "coupling"
          ? buildCoupling(d, SECTION_LENGTH / 2, couplingMat, uvScale, screwMat)
          : c === "flange"
            ? buildFlange(d, SECTION_LENGTH / 2, metal, sheet, uvScale, gasketMat, screwMat)
            : null;
      if (conn) {
        model.add(conn.group);
        // Short 12" piece joined on with the connection, so the joint reads as two pipes going together.
        const piece = buildPipe(d, mats, JOIN_LENGTH);
        piece.position.x = conn.joinStart + JOIN_LENGTH / 2;
        model.add(piece);
        moving = [
          ...conn.motion.parts.map((m) => ({ ...m, base: m.obj.position.x })),
          { obj: piece, base: piece.position.x, ...conn.motion.piece },
        ];
        screws = conn.screws?.items ?? [];
        if (conn.screws) model.add(conn.screws.group);
        playMs = conn.screws ? SLIDE_MS + SCREW_PAUSE_MS + SCREW_MS : SLIDE_MS;
      } else {
        moving = [];
        screws = [];
      }
      stopPlay();
      scene.add(model);
      spangle.repeat.set(Math.max(2, Math.round((Math.PI * d) / 10)), SECTION_LENGTH / 10);
      frame(d);
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
    let currentD = 12;
    let currentC: Connection = "none";
    resize();
    build(currentD, currentC);
    const ro = new ResizeObserver(() => {
      resize();
      frame(currentD);
    });
    ro.observe(el);

    api.current = {
      setDiameter: (d) => {
        if (d === currentD) return;
        currentD = d;
        build(currentD, currentC);
      },
      setConnection: (c) => {
        if (c === currentC) return;
        currentC = c;
        build(currentD, currentC);
      },
      reset: () => {
        stopPlay();
        frame(currentD);
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
      [metal, seamMat, inside, sheet, couplingMat, screwMat, gasketMat].forEach((m) => m.dispose());
      [spangle, shadowTex].forEach((t) => t.dispose());
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    api.current?.setDiameter(diameter);
  }, [diameter]);
  useEffect(() => {
    api.current?.setConnection(connection);
  }, [connection]);
  const info = connection === "none" ? null : CONNECTION_INFO[connection];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]"
      role="dialog"
      aria-modal="true"
      aria-label="3D model: single wall round spiral pipe"
    >
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Single Wall Round Spiral Pipe</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full bg-white/15 active:bg-white/25"
          aria-label="Close 3D model"
        >
          <X className="size-6" />
        </button>
      </header>
      <div ref={host} className="relative min-h-0 flex-1">
        {failed && (
          <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted">
            3D isn&apos;t available on this device (WebGL is turned off or not supported).
          </p>
        )}
        {hint && !failed && (
          <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs font-medium text-steel">
            Drag to turn · pinch to zoom
          </p>
        )}
        {info && !failed && (
          <div
            className="pointer-events-none absolute inset-x-3 bottom-3 rounded-[0.65rem] border border-[#8e9bab]/60 bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgb(0_28_64/0.18)] short:inset-x-auto short:top-3 short:bottom-auto short:left-3 short:py-1"
            aria-live="polite"
            data-testid="connection-caption"
          >
            <p className="font-display text-lg leading-tight text-accent">{info.title}</p>
            <p className="text-xs leading-snug text-ink short:hidden">{info.text}</p>
          </div>
        )}
      </div>
      <div className="border-t border-[#8e9bab]/50 bg-surface/90 px-3 pt-2.5 short:pt-1.5" role="radiogroup" aria-label="Connection">
        {/* Label row; the Play button sits in the right column, over Flange (row height is kept for None). */}
        <div className="grid h-9 grid-cols-3 items-end gap-2 short:h-8">
          <span className="col-span-2 text-[11px] font-medium tracking-wide text-muted uppercase">Connection</span>
          {connection !== "none" && !failed && (
            <button
              type="button"
              onClick={() => api.current?.play()}
              aria-label={play === "playing" ? "Pause" : play === "done" ? "Replay how it goes together" : "Play how it goes together"}
              className="btn-raised btn-raised-sm mb-1 flex h-8 items-center justify-center gap-1.5 rounded-[0.65rem] font-display text-base leading-none short:h-7"
            >
              {play === "playing" ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : play === "done" ? (
                <RotateCw className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
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
      <div className="flex items-center gap-2 bg-surface/90 px-3 py-2.5" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <label className="flex max-w-44 min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Diameter</span>
          <select
            value={diameter}
            onChange={(e) => setDiameter(Number(e.target.value))}
            className="btn-raised btn-raised-sm mt-1 h-10 rounded-[0.65rem] px-2 font-display text-lg"
          >
            {STOCK_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}&Prime; round
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-[1.3] text-xs leading-snug text-ink">
          <p>
            <b className="font-semibold">{gauge.pipe} ga</b> pipe · <b className="font-semibold">{gauge.fitting} ga</b> fittings
          </p>
          <p className="text-muted">Galvanized · stock 10&prime;-0&Prime; lengths (4&prime; shown)</p>
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
