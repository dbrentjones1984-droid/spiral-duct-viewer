// Catalog data (product lines, sheets, item codes) is removed for now while we work on the interface.
// The full data and assets are backed up in /workspace/spiral-duct-catalog-backup (see RESTORE.md there).

export const HOME_BUTTONS = [
  { id: "single-duct", label: ["Single Wall", "Duct"] },
  { id: "single-fitting", label: ["Single", "Fitting"] },
  { id: "double-duct", label: ["Double", "Duct"] },
  { id: "double-fitting", label: ["Double", "Fitting"] },
] as const;

export type HomeButtonId = (typeof HOME_BUTTONS)[number]["id"];
