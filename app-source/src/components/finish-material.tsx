import { useMemo } from "react";
import * as THREE from "three";
import type { ShellFinish } from "@/lib/piece-menus";

function lookFor(id: string) {
  if (id === "paint-grip") return { env: 0.35, aniso: 0, coat: 0.04, coatRough: 0.7 };
  if (id === "black-iron") return { env: 0.85, aniso: 0.15, coat: 0.2, coatRough: 0.4 };
  if (id === "pvc") return { env: 0.45, aniso: 0, coat: 0.55, coatRough: 0.22 };
  if (id === "aluminum-type-1" || id === "aluminum-3003") return { env: 1.35, aniso: 0.35, coat: 0.28, coatRough: 0.22 };
  if (id === "ss-304" || id === "ss-316" || id === "agion") return { env: 1.45, aniso: 0.4, coat: 0.3, coatRough: 0.18 };
  return { env: 1.25, aniso: 0.2, coat: 0.16, coatRough: 0.32 };
}

export function DuctMetal({
  finish,
  alphaMap,
  emissive,
  emissiveIntensity = 0,
  faded = false,
}: {
  finish: ShellFinish;
  alphaMap?: THREE.Texture | null;
  emissive?: string;
  emissiveIntensity?: number;
  faded?: boolean;
}) {
  const look = lookFor(finish.id);
  const color = useMemo(() => {
    const next = new THREE.Color(finish.color);
    next.multiplyScalar(0.74);
    return `#${next.getHexString()}`;
  }, [finish.color]);
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={finish.metalness * 0.9}
      roughness={Math.min(1, finish.roughness + 0.16)}
      envMapIntensity={look.env * 0.62}
      anisotropy={look.aniso * 0.5}
      anisotropyRotation={Math.PI / 2}
      clearcoat={look.coat * 0.25}
      clearcoatRoughness={Math.min(1, look.coatRough + 0.2)}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissiveIntensity}
      alphaMap={alphaMap ?? undefined}
      alphaTest={alphaMap ? 0.5 : 0}
      opacity={faded ? 0.6 : 1}
      transparent={faded}
      depthWrite={!faded}
      side={THREE.DoubleSide}
    />
  );
}

export function InsulationMaterial({ faded = false }: { faded?: boolean }) {
  return (
    <meshPhysicalMaterial
      color="#e6c98a"
      roughness={0.92}
      metalness={0}
      envMapIntensity={0.08}
      opacity={faded ? 0.6 : 1}
      transparent={faded}
      depthWrite={!faded}
      side={THREE.DoubleSide}
    />
  );
}
