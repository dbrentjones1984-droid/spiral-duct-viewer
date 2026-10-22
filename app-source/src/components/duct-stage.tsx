import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import * as THREE from "three";
import { shellFinishById, type PieceId, type ShellFinish } from "@/lib/piece-menus";
import { DuctMetal, InsulationMaterial } from "@/components/finish-material";
import {
  DUCT,
  createInsulation,
  createLiner,
  createRingFlange,
  createSpiralBead,
  createSpiralShell,
} from "@/components/spiral-geometry";

RectAreaLightUniformsLib.init();

const GALVANIZED = shellFinishById("galvanized");

function StudioEnv() {
  const gl = useThree((s) => s.gl);
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return env;
  }, [gl]);

  useEffect(() => () => texture.dispose(), [texture]);

  return <primitive attach="environment" object={texture} />;
}

type Spread = "one" | "both";

const FULL_GAP = 36;

function pieceLayout(gap: number, spread: Spread) {
  const half = DUCT.length / 2;
  const flangeLen = 1.4;
  const innerLen = DUCT.length;
  const insulLen = DUCT.length - 1.8;
  const outerLen = DUCT.length;
  const span = flangeLen + innerLen + insulLen + outerLen + flangeLen + gap * 4;
  let edge = spread === "both" ? -span / 2 : -half - flangeLen / 2;
  const take = (len: number) => {
    const center = edge + len / 2;
    edge += len + gap;
    return center;
  };
  const leftX = take(flangeLen);
  const innerX = take(innerLen);
  const insulX = take(insulLen);
  const outerX = take(outerLen);
  const rightX = take(flangeLen);
  return {
    leftX,
    innerX,
    insulX,
    outerX,
    rightX,
    minX: leftX - flangeLen / 2,
    maxX: rightX + flangeLen / 2,
  };
}

function explodedCorners(gap: number, spread: Spread) {
  const layout = pieceLayout(gap, spread);
  const radial = DUCT.outerRadius + DUCT.flangeLeg + 1;
  const pts: THREE.Vector3[] = [];
  for (const x of [layout.minX - 2, layout.maxX + 2]) {
    for (const y of [-radial, radial + 3]) {
      for (const z of [-radial, radial]) {
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return { pts, centerX: (layout.minX + layout.maxX) / 2 };
}

function frameExploded(look: THREE.Vector3, camera: THREE.PerspectiveCamera, gap: number, spread: Spread) {
  const framed = explodedCorners(gap, spread);
  const target = new THREE.Vector3(framed.centerX, 0, 0);
  const corners = framed.pts;
  const aspect = camera.aspect > 0 ? camera.aspect : 1.4;
  const probe = new THREE.PerspectiveCamera(camera.fov, aspect, 0.1, 4000);
  const ndc = new THREE.Vector3();
  const fits = (distance: number) => {
    probe.position.copy(target).addScaledVector(look, -distance);
    probe.up.set(0, 1, 0);
    probe.lookAt(target);
    probe.updateMatrixWorld();
    probe.updateProjectionMatrix();
    for (const corner of corners) {
      ndc.copy(corner).project(probe);
      if (ndc.z < -1 || ndc.z > 1) return false;
      if (Math.abs(ndc.x) > 0.82 || Math.abs(ndc.y) > 0.8) return false;
    }
    return true;
  };
  let lo = 40;
  let hi = 1400;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  const distance = hi * 1.08;
  return {
    position: target.clone().addScaledVector(look, -distance),
    target,
  };
}

function CameraRig({
  resetKey,
  spinning,
  exploded,
  spread,
  focus,
}: {
  resetKey: number;
  spinning: boolean;
  exploded: boolean;
  spread: Spread;
  focus: { x: number; y: number; z: number; n: number } | null;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const explodedNow = useRef(exploded);
  explodedNow.current = exploded;
  const spreadNow = useRef(spread);
  spreadNow.current = spread;
  const [orbitTarget, setOrbitTarget] = useState<[number, number, number]>([2, 0, 0]);
  const focusGoal = useRef<THREE.Vector3 | null>(null);

  const place = (pos: THREE.Vector3, target: THREE.Vector3) => {
    const rig = controls as { target?: THREE.Vector3; update?: () => void } | null;
    camera.position.copy(pos);
    rig?.target?.copy(target);
    setOrbitTarget([target.x, target.y, target.z]);
    rig?.update?.();
  };

  useEffect(() => {
    focusGoal.current = null;
    const homePos = new THREE.Vector3(54, 14, 28);
    const homeTarget = new THREE.Vector3(2, 0, 0);
    if (!explodedNow.current) {
      place(homePos, homeTarget);
      return;
    }
    const look = homeTarget.clone().sub(homePos).normalize();
    const fitted = frameExploded(look, camera as THREE.PerspectiveCamera, FULL_GAP, spreadNow.current);
    place(fitted.position, fitted.target);
  }, [resetKey, camera, controls]);

  useEffect(() => {
    const rig = controls as { target?: THREE.Vector3; update?: () => void } | null;
    if (!exploded || !rig?.target) return;
    focusGoal.current = null;
    const from = camera.position.clone();
    const at = rig.target.clone();
    const look = at.clone().sub(from);
    if (look.lengthSq() < 1e-4) look.set(-52, -14, -28);
    look.normalize();
    const fitted = frameExploded(look, camera as THREE.PerspectiveCamera, FULL_GAP, spreadNow.current);
    place(fitted.position, fitted.target);
  }, [exploded]);

  useEffect(() => {
    if (!focus) return;
    focusGoal.current = new THREE.Vector3(focus.x, focus.y, focus.z);
  }, [focus]);

  useFrame((_, delta) => {
    const goal = focusGoal.current;
    const rig = controls as { target?: THREE.Vector3; update?: () => void } | null;
    if (!goal || !rig?.target) return;
    const step = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    const offset = camera.position.clone().sub(rig.target);
    rig.target.lerp(goal, step);
    camera.position.copy(rig.target).add(offset);
    if (rig.target.distanceTo(goal) < 0.08) {
      rig.target.copy(goal);
      camera.position.copy(goal).add(offset);
      focusGoal.current = null;
      setOrbitTarget([goal.x, goal.y, goal.z]);
    }
    rig.update?.();
  });

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      autoRotate={spinning}
      autoRotateSpeed={0.42}
      minDistance={6}
      maxDistance={1600}
      zoomToCursor
      target={orbitTarget}
    />
  );
}

const press = {
  id: -1,
  x: 0,
  y: 0,
  t: 0,
  piece: null as PieceId | null,
  point: new THREE.Vector3(),
};

function piecePointer(piece: PieceId) {
  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      press.id = event.pointerId;
      press.x = event.nativeEvent.clientX;
      press.y = event.nativeEvent.clientY;
      press.t = performance.now();
      press.piece = piece;
      event.object.getWorldPosition(press.point);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

function TapPick({ onPick }: { onPick: (piece: PieceId, x: number, y: number, point: THREE.Vector3) => void }) {
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  useEffect(() => {
    const clear = () => {
      press.piece = null;
    };
    const up = (event: PointerEvent) => {
      const piece = press.piece;
      press.piece = null;
      if (!piece || event.pointerId !== press.id) return;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const limit = coarse ? 64 : 16;
      if (dx * dx + dy * dy > limit * limit) return;
      if (performance.now() - press.t > (coarse ? 900 : 500)) return;
      onPickRef.current(piece, event.clientX, event.clientY, press.point.clone());
    };
    window.addEventListener("pointerdown", clear, true);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerdown", clear, true);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", clear);
    };
  }, []);
  return null;
}

function FlangeMesh({
  geometry,
  selected,
  faded,
}: {
  geometry: THREE.BufferGeometry;
  selected: boolean;
  faded: boolean;
}) {
  return (
    <mesh geometry={geometry} castShadow {...piecePointer("flange")}>
      <DuctMetal
        finish={GALVANIZED}
        faded={faded}
        emissive={selected ? "#b45309" : "#000000"}
        emissiveIntensity={selected ? 0.35 : 0}
      />
    </mesh>
  );
}

function perforationMap(radius: number, length: number, open: boolean) {
  const size = 128;
  const step = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  const holesPerTile = size / step;
  const spacing = 0.18;
  tex.repeat.set(
    ((open ? 0.75 : 1) * Math.PI * 2 * radius) / spacing / holesPerTile,
    length / spacing / holesPerTile,
  );
  tex.anisotropy = 8;
  return tex;
}

function Assembly({
  section,
  flangeSelected,
  activePiece,
  shellFinish,
  linerFinish,
  linerPerforated,
  apart,
  spread,
  onPickPiece,
}: {
  section: boolean;
  flangeSelected: boolean;
  activePiece: PieceId | null;
  shellFinish: ShellFinish;
  linerFinish: ShellFinish;
  linerPerforated: boolean;
  apart: number;
  spread: Spread;
  onPickPiece: (piece: PieceId, x: number, y: number, point: THREE.Vector3) => void;
}) {
  const shell = useMemo(
    () => createSpiralShell(DUCT.outerRadius, DUCT.length, DUCT.pitch, section),
    [section],
  );
  const bead = useMemo(
    () => createSpiralBead(DUCT.outerRadius, DUCT.length, DUCT.pitch, section),
    [section],
  );
  const liner = useMemo(
    () => createLiner(DUCT.innerRadius, DUCT.length, section),
    [section],
  );
  const linerBead = useMemo(
    () => createSpiralBead(DUCT.innerRadius, DUCT.length, DUCT.pitch, section),
    [section],
  );
  const holes = useMemo(
    () => (linerPerforated ? perforationMap(DUCT.innerRadius, DUCT.length, section) : null),
    [linerPerforated, section],
  );
  const flange = useMemo(
    () => createRingFlange(DUCT.innerRadius, DUCT.outerRadius, section, 0),
    [section],
  );
  const flangeFar = useMemo(
    () => createRingFlange(DUCT.innerRadius, DUCT.outerRadius, section, Math.PI / 2),
    [section],
  );
  const insulation = useMemo(
    () => createInsulation(DUCT.innerRadius, DUCT.outerRadius, DUCT.length - 1.8, section),
    [section],
  );

  useEffect(() => {
    return () => {
      shell.dispose();
      bead.dispose();
      liner.dispose();
      linerBead.dispose();
      holes?.dispose();
      flange.dispose();
      flangeFar.dispose();
      insulation.dispose();
    };
  }, [shell, bead, liner, linerBead, holes, flange, flangeFar, insulation]);

  const shellGroup = useRef<THREE.Group>(null);
  const insulGroup = useRef<THREE.Group>(null);
  const linerGroup = useRef<THREE.Group>(null);
  const rightFlange = useRef<THREE.Group>(null);
  const leftFlange = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = apart / 100;
    const half = DUCT.length / 2;
    const layout = pieceLayout(FULL_GAP, spread);
    const mix = (from: number, to: number) => from + (to - from) * t;
    if (linerGroup.current) linerGroup.current.position.set(mix(0, layout.innerX), 0, 0);
    if (insulGroup.current) insulGroup.current.position.set(mix(0, layout.insulX), 0, 0);
    if (shellGroup.current) shellGroup.current.position.set(mix(0, layout.outerX), 0, 0);
    if (rightFlange.current) rightFlange.current.position.x = mix(half, layout.rightX);
    if (leftFlange.current) leftFlange.current.position.x = mix(-half, layout.leftX);
  });

  const half = DUCT.length / 2;
  const fade = (piece: PieceId) => activePiece !== null && activePiece !== piece;

  return (
    <group>
      <group ref={linerGroup}>
        <mesh geometry={liner} castShadow {...piecePointer("liner")}>
          <DuctMetal finish={linerFinish} alphaMap={holes} faded={fade("liner")} />
        </mesh>
        <mesh geometry={linerBead} castShadow {...piecePointer("liner")}>
          <DuctMetal finish={linerFinish} faded={fade("liner")} />
        </mesh>
      </group>

      <group ref={insulGroup}>
        <mesh geometry={insulation} {...piecePointer("insulation")}>
          <InsulationMaterial faded={fade("insulation")} />
        </mesh>
      </group>

      <group ref={shellGroup}>
        <mesh geometry={shell} castShadow {...piecePointer("shell")}>
          <DuctMetal finish={shellFinish} faded={fade("shell")} />
        </mesh>
        <mesh geometry={bead} castShadow {...piecePointer("shell")}>
          <DuctMetal finish={shellFinish} faded={fade("shell")} />
        </mesh>
      </group>

      <group ref={rightFlange} position={[half, 0, 0]}>
        <group rotation={[0, 0, -Math.PI / 2]}>
          <FlangeMesh geometry={flange} selected={flangeSelected} faded={fade("flange")} />
        </group>
      </group>
      <group ref={leftFlange} position={[-half, 0, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <FlangeMesh geometry={flangeFar} selected={flangeSelected} faded={fade("flange")} />
        </group>
      </group>
    </group>
  );
}

export default function DuctStage({
  exploded,
  spinning,
  resetKey,
  section,
  flangeSelected,
  activePiece,
  shellFinish,
  linerFinish,
  linerPerforated,
  apart,
  spread,
  onPickPiece,
  onCloseMenu,
  focus,
}: {
  exploded: boolean;
  spinning: boolean;
  resetKey: number;
  section: boolean;
  flangeSelected: boolean;
  activePiece: PieceId | null;
  shellFinish: ShellFinish;
  linerFinish: ShellFinish;
  linerPerforated: boolean;
  apart: number;
  spread: Spread;
  onPickPiece: (piece: PieceId, x: number, y: number, point: THREE.Vector3) => void;
  onCloseMenu: () => void;
  focus: { x: number; y: number; z: number; n: number } | null;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
      camera={{ position: [54, 14, 28], fov: 28, near: 0.1, far: 4000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.12;
      }}
      onPointerMissed={() => onCloseMenu()}
      aria-label="Double-wall spiral duct, drag to turn"
    >
      <color attach="background" args={["#c4c2bd"]} />
      <TapPick onPick={onPickPiece} />
      <StudioEnv />
      <ambientLight intensity={0.38} />
      <hemisphereLight args={["#f7f5f0", "#8ea0b0", 0.45]} />
      <rectAreaLight position={[16, 24, 18]} rotation={[-0.8, 0.35, 0.1]} width={56} height={18} intensity={18} color="#ffffff" />
      <rectAreaLight position={[-24, 10, -6]} rotation={[0.2, 0.8, 0]} width={28} height={12} intensity={6} color="#eef3f8" />
      <directionalLight
        position={[28, 36, 18]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <directionalLight position={[-20, 8, -16]} intensity={0.35} color="#d5e0ea" />
      <directionalLight position={[10, 4, 30]} intensity={0.28} />
      <Assembly
        section={section}
        flangeSelected={flangeSelected}
        activePiece={activePiece}
        shellFinish={shellFinish}
        linerFinish={linerFinish}
        linerPerforated={linerPerforated}
        apart={apart}
        spread={spread}
        onPickPiece={onPickPiece}
      />
      <CameraRig resetKey={resetKey} spinning={spinning} exploded={exploded} spread={spread} focus={focus} />
    </Canvas>
  );
}
