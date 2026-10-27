import { useEffect, useRef, useState } from "react";
import { FileText, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONNECTION_INFO, CONNECTIONS, JOIN_LENGTH, type BuiltConnection, type Connection } from "@/components/duct-connections";
import {
  buildOvalCoupling,
  buildOvalFlange,
  OVAL_EQ_D,
  OVAL_MAJOR,
  OVAL_MINOR,
  OVAL_R,
  ovalPerimeter,
  ovalPoint,
  ovalOutline,
  ovalShell,
} from "@/components/oval-connections";
import { shadowTexture, spangleTexture } from "@/components/spiral-pipe-3d";

/*
 * Interactive 3D model of single wall flat-oval spiral duct (Single Wall Duct > Oval): the same viewer as the round
 * model (spiral-pipe-3d.tsx: orbit controls, lighting, materials, Coupling / Flange with Play), shown at one size,
 * 25" x 16" (the sheets list the rest). Spiral lock seams wrap around the oval like the round pipe. Units are inches.
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

/** Spiral lock seam: wraps the oval once per strip pitch, at even speed along the perimeter (like the round helix). */
class OvalHelix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private rho: number,
    private length: number,
    private pitch: number,
    private phase = 0, // fraction of the way around
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const x = -this.length / 2 + t * this.length;
    const [y, z] = ovalPoint(x / this.pitch + this.phase, this.rho, OVAL_R);
    return target.set(x, y, z);
  }
}

type PipeMats = { metal: THREE.Material; inside: THREE.Material; seam: THREE.Material; rim: THREE.Material };

function buildPipe({ metal, inside, seam: seamMat, rim }: PipeMats, L = SECTION_LENGTH) {
  const group = new THREE.Group();
  const d = OVAL_EQ_D;
  const R = OVAL_R;
  const P = ovalPerimeter(R);
  const wall = Math.max(0.05, d * 0.006);
  const S = 256;
  const uvScale = 1 / SECTION_LENGTH;
  group.add(new THREE.Mesh(ovalShell([-L / 2, L / 2], S, () => R, uvScale), metal));
  group.add(new THREE.Mesh(ovalShell([-L / 2, L / 2], S, () => R - wall, uvScale), inside));

  // Lock seam: raised double rib wrapping around the oval (folded strip edges), plus its flat line inside.
  const turns = L / STRIP_PITCH;
  const segs = Math.round(turns * 160);
  const rib = Math.min(0.2, 0.09 + d * 0.004);
  const seamL = L - rib * 4;
  const lockA = new THREE.TubeGeometry(new OvalHelix(R + rib * 0.15, seamL, STRIP_PITCH), segs, rib, 8, false);
  const lockB = new THREE.TubeGeometry(new OvalHelix(R + rib * 0.05, seamL, STRIP_PITCH, (rib * 2.1) / P), segs, rib * 0.75, 8, false);
  const lockIn = new THREE.TubeGeometry(new OvalHelix(R - wall - 0.01, seamL, STRIP_PITCH, rib / P), segs, rib * 0.4, 6, false);
  group.add(new THREE.Mesh(lockA, seamMat), new THREE.Mesh(lockB, seamMat), new THREE.Mesh(lockIn, inside));

  // Cut ends: thin oval rims so the open ends read as sheet metal.
  for (const x of [-L / 2, L / 2]) {
    const shape = new THREE.Shape(ovalOutline(R + 0.005, S));
    shape.holes.push(new THREE.Path(ovalOutline(R - wall, S).reverse()));
    const ring = new THREE.ShapeGeometry(shape, 1);
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

export default function OvalPipe3D({ onClose }: { onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setConnection: (c: Connection) => void;
    reset: () => void;
    play: () => void;
  } | null>(null);
  const [play, setPlay] = useState<PlayState>("idle");
  const [connection, setConnection] = useState<Connection>("none");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);

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
    renderer.domElement.setAttribute("aria-label", "3D flat oval spiral duct, 25 by 16 inches. Drag to turn, pinch to zoom.");
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
    const frame = () => {
      // Portrait phones: stand the duct up (shows the open oval end and fills the tall screen), turned so the 25"
      // major axis runs across the screen; wide screens: lay it down flat side up (like Brent's photo).
      const upright = camera.aspect < 0.9;
      if (!model) return;
      model.rotation.order = "ZYX"; // turn about the duct axis first, then stand it up
      model.rotation.set(upright ? Math.PI / 2 : 0, 0, upright ? Math.PI / 2 : 0);
      model.updateMatrixWorld(true);
      const W = OVAL_MAJOR;
      const H = OVAL_MINOR;
      if (upright) {
        shadow.scale.set(W * 2.2, H * 2.6, 1);
        shadow.position.set(0, -SECTION_LENGTH / 2 - 0.05, 0);
      } else {
        const box = new THREE.Box3().setFromObject(model);
        shadow.scale.set((box.max.x - box.min.x) * 1.15, W * 1.9, 1);
        shadow.position.set((box.max.x + box.min.x) / 2, -H / 2 - 0.05, 0);
      }
      const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const along = SECTION_LENGTH / 2 + W * 0.3;
      const across = W / 2 + W * 0.12;
      const halfH = upright ? along : H / 2 + H * 0.15 + SECTION_LENGTH * 0.12;
      const halfW = upright ? across : along * 0.92;
      fitDistance = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.12 + W / 2;
      if (conn) {
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
      controls.minDistance = W * 0.75;
      controls.maxDistance = fitDistance * 2.2;
      camera.near = Math.max(0.1, W * 0.04);
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

    const build = (c: Connection) => {
      if (model) {
        scene.remove(model);
        disposeGroup(model);
      }
      model = new THREE.Group();
      const mats = solidPipe;
      model.add(buildPipe(mats));
      const uvScale = 1 / SECTION_LENGTH; // same spangle scale as the pipe
      conn =
        c === "coupling"
          ? buildOvalCoupling(SECTION_LENGTH / 2, couplingMat, uvScale, screwMat)
          : c === "flange"
            ? buildOvalFlange(SECTION_LENGTH / 2, metal, sheet, uvScale, gasketMat, screwMat)
            : null;
      if (conn) {
        model.add(conn.group);
        // Short 12" piece joined on with the connection, so the joint reads as two pipes going together.
        const piece = buildPipe(mats, JOIN_LENGTH);
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
      spangle.repeat.set(Math.round(ovalPerimeter(OVAL_R) / 10), SECTION_LENGTH / 10);
      frame();
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
    let currentC: Connection = "none";
    resize();
    build(currentC);
    const ro = new ResizeObserver(() => {
      resize();
      frame();
    });
    ro.observe(el);

    api.current = {
      setConnection: (c) => {
        if (c === currentC) return;
        currentC = c;
        build(currentC);
      },
      reset: () => {
        stopPlay();
        frame();
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
    api.current?.setConnection(connection);
  }, [connection]);
  const info = connection === "none" ? null : CONNECTION_INFO[connection];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#eef2f6] to-[#bcc7d3]"
      role="dialog"
      aria-modal="true"
      aria-label="3D model: single wall flat oval spiral duct"
    >
      <header className="flex items-center gap-2 bg-accent px-3 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none tracking-wide">3D MODEL</p>
          <p className="truncate text-xs text-white/80">Single Wall Flat Oval Spiral Duct · 25&Prime; × 16&Prime;</p>
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
        {/* One size only (Brent): where Round has the diameter picker, say which size is shown and point to the charts. */}
        <div className="min-w-0 flex-1 leading-snug" data-testid="oval-size-note">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Size shown</span>
          <p className="font-display text-lg leading-tight whitespace-nowrap text-ink">
            {OVAL_MAJOR}&Prime; × {OVAL_MINOR}&Prime; <span className="font-sans text-xs text-muted">flat oval</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-raised btn-raised-sm flex h-11 shrink-0 items-center gap-1.5 rounded-[0.65rem] px-2.5 font-display text-base leading-none whitespace-nowrap"
        >
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          See chart for sizes
        </button>
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
