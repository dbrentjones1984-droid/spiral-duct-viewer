export type PieceId = "flange" | "shell" | "insulation" | "liner";

export type PieceMenuItem = {
  id: string;
  label: string;
  swatch?: string;
  group?: string;
};

export type ShellFinish = {
  id: string;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
};

export const SHELL_FINISHES: ShellFinish[] = [
  { id: "galvanized", label: "Galvanized steel", color: "#d8dce1", metalness: 0.9, roughness: 0.26 },
  { id: "paint-grip", label: "Paint Grip", color: "#a3a199", metalness: 0.12, roughness: 0.82 },
  { id: "black-iron", label: "Black Iron", color: "#2a2a2c", metalness: 0.55, roughness: 0.32 },
  { id: "aluminum-type-1", label: "Aluminum Steel - type 1", color: "#f2f4f6", metalness: 0.92, roughness: 0.18 },
  { id: "pvc", label: "Poly-vinyl coated Steel", color: "#5c656e", metalness: 0.04, roughness: 0.32 },
  { id: "aluminum-3003", label: "3003 Aluminum", color: "#f7f8f8", metalness: 0.78, roughness: 0.22 },
  { id: "ss-304", label: "304-L Stainless Steel", color: "#e4e7ea", metalness: 0.95, roughness: 0.14 },
  { id: "ss-316", label: "316-L Stainless Steel", color: "#f4f5f5", metalness: 0.97, roughness: 0.1 },
  { id: "agion", label: "Agion Anti-Microbial Steel", color: "#d5ddd4", metalness: 0.9, roughness: 0.22 },
];

export function shellFinishById(id: string) {
  return SHELL_FINISHES.find((finish) => finish.id === id) ?? SHELL_FINISHES[0];
}

export const PIECE_MENUS: Record<PieceId, { label: string; items: PieceMenuItem[] }> = {
  flange: {
    label: "Flange",
    items: [{ id: "accuflange", label: "AccuFlange sheet" }],
  },
  shell: {
    label: "Outer shell",
    items: SHELL_FINISHES.map((finish) => ({ id: finish.id, label: finish.label, swatch: finish.color })),
  },
  insulation: {
    label: "Insulation",
    items: [],
  },
  liner: {
    label: "Inner shell",
    items: [
      ...SHELL_FINISHES.map((finish) => ({
        id: `solid:${finish.id}`,
        label: finish.label,
        swatch: finish.color,
        group: "Solid",
      })),
      {
        id: "perforated",
        label: "Galvanized steel",
        swatch: "#c5c9ce",
        group: "Perforated",
      },
    ],
  },
};
