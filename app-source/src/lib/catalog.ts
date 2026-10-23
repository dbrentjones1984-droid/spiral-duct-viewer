// Catalog data (product lines, sheets, item codes) is removed for now while we work on the interface.
// The full data and assets are backed up in /workspace/spiral-duct-catalog-backup (see RESTORE.md there).

export const HOME_BUTTONS = [
  { id: "single-duct", label: ["Single Wall", "Duct"] },
  { id: "single-fitting", label: ["Single Wall", "Fittings"] },
  { id: "double-duct", label: ["Double Wall", "Duct"] },
  { id: "double-fitting", label: ["Double Wall", "Fittings"] },
] as const;

export type HomeButtonId = (typeof HOME_BUTTONS)[number]["id"];
