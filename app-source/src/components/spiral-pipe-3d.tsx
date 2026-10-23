import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { STOCK_DIAMETERS, stockGauge } from "@/lib/sheets";

/*
 * Interactive 3D model of single wall round spiral pipe (Single Wall Duct > Round), based on Brent's sheets:
 * galvanized spiral pipe with a helical lock seam, plain (female) slip-joint ends, stocked in 10'-0" lengths,
 * 3"-24" stock sizes with the sheet-1 gauges. Plain three.js (no React Three Fiber) and loaded only when the
 * "View 3D Model" button is pressed, to keep the main app light. Units are inches.
 */

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

function buildPipe(diameter: number, metal: THREE.Material, inside: THREE.Material, seamMat: THREE.Material) {
  const group = new THREE.Group();
  const r = diameter / 2;
  const wall = Math.max(0.05, diameter * 0.006); // drawn a little thicker than 26 ga (0.022") so the rim shows
  const L = SECTION_LENGTH;
  const radial = Math.min(160, 64 + Math.round(diameter * 4));

  const outer = new THREE.CylinderGeometry(r, r, L, radial, 1, true);
  outer.rotateZ(-Math.PI / 2);
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
    group.add(new THREE.Mesh(ring, metal));
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
  const api = useRef<{ setDiameter: (d: number) => void; reset: () => void } | null>(null);
  const [diameter, setDiameter] = useState(12);
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

    let pipe: THREE.Group | null = null;
    let fitDistance = 100;
    const frame = (d: number) => {
      // Portrait phones: stand the pipe up (shows the open end and fills the tall screen); wide screens: lay it down.
      const upright = camera.aspect < 0.9;
      if (pipe) pipe.rotation.z = upright ? Math.PI / 2 : 0;
      shadow.scale.set(upright ? d * 2.4 : SECTION_LENGTH * 1.25, upright ? d * 2.4 : d * 2.2, 1);
      shadow.position.y = upright ? -SECTION_LENGTH / 2 - 0.05 : -d / 2 - 0.05;
      // Fit the pipe's on-screen box (long side x diameter) with a margin.
      const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const along = SECTION_LENGTH / 2 + d * 0.3;
      const across = d / 2 + d * 0.15;
      const halfH = upright ? along : across + SECTION_LENGTH * 0.12;
      const halfW = upright ? across : along * 0.92;
      fitDistance = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.12 + d / 2;
      const dir = (upright ? new THREE.Vector3(0.5, 0.36, 1) : new THREE.Vector3(0.55, 0.42, 1)).normalize();
      camera.position.copy(dir.multiplyScalar(fitDistance));
      controls.target.set(0, 0, 0);
      controls.minDistance = d * 0.9;
      controls.maxDistance = fitDistance * 2.2;
      camera.near = Math.max(0.1, d * 0.05);
      camera.far = fitDistance * 6;
      camera.updateProjectionMatrix();
      controls.update();
    };
    const setPipe = (d: number) => {
      if (pipe) {
        scene.remove(pipe);
        disposeGroup(pipe);
      }
      pipe = buildPipe(d, metal, inside, seamMat);
      scene.add(pipe);
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
    resize();
    setPipe(currentD);
    const ro = new ResizeObserver(() => {
      resize();
      if (pipe) frame(currentD);
    });
    ro.observe(el);

    api.current = {
      setDiameter: (d) => {
        currentD = d;
        setPipe(d);
      },
      reset: () => {
        frame(currentD);
        controls.autoRotate = true;
      },
    };

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      api.current = null;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      if (pipe) disposeGroup(pipe);
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      [metal, seamMat, inside].forEach((m) => m.dispose());
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
      </div>
      <div className="flex items-center gap-2 border-t border-[#8e9bab]/50 bg-surface/90 px-3 py-2.5" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
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
