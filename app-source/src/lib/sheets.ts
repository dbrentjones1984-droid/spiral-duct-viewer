// Single Wall Duct · Round: Brent's redesigned catalog sheets 1-5 (single-wall-round.pdf).
// The PDF is image-only (one ~1100x1430 scan per page), so the sheets are shown as WebP images at that full
// resolution; the original PDF is offered as a download.

const base = import.meta.env.BASE_URL;

export const SW_ROUND_PDF = {
  href: `${base}docs/Spiral-Systems-Single-Wall-Round-Duct.pdf`,
  fileName: "Spiral-Systems-Single-Wall-Round-Duct.pdf",
  sizeLabel: "7.4 MB",
};

export const SW_ROUND_SHEETS = [
  {
    n: 1,
    title: "Stock Pipe and Fittings",
    src: `${base}sheets/single-wall-round-1.webp`,
    w: 1103,
    h: 1426,
    alt: "Sheet 1, Single Wall Round, Stock Pipe and Fittings: Spiral Systems stock galvanized gauges by diameter (3 to 24 inch), spiral pipe and fitting gauge, and stocking notes.",
  },
  {
    n: 2,
    title: "Positive Pressure Gauges",
    src: `${base}sheets/single-wall-round-2.webp`,
    w: 1103,
    h: 1426,
    alt: "Sheet 2, Single Wall Round, Positive Pressure: spiral duct and fitting construction standards, gauges for +2, +4 and +10 inch W.G., 3 to 84 inch diameter.",
  },
  {
    n: 3,
    title: "Negative Pressure Gauges",
    src: `${base}sheets/single-wall-round-3.webp`,
    w: 1102,
    h: 1427,
    alt: "Sheet 3, Single Wall Round, Negative Pressure: spiral duct and fitting construction standards, gauges for -2, -4 and -10 inch W.G., 3 to 48 inch diameter, with reinforcement ring notes.",
  },
  {
    n: 4,
    title: "Aluminum & Underground PVC Coated Gauges",
    src: `${base}sheets/single-wall-round-4.webp`,
    w: 1102,
    h: 1427,
    alt: "Sheet 4, Single Wall Round: Aluminum 3003-H14 gauges for +2 and -2 inch W.G., and underground PVC coated spiral duct gauges with load specifications.",
  },
  {
    n: 5,
    title: "Material & Fabrication Options",
    src: `${base}sheets/single-wall-round-5.webp`,
    w: 1133,
    h: 1388,
    alt: "Sheet 5, Single Wall Round, Spiral Pipe and Fittings Material and Fabrication Options: galvanized, paint grade, aluminum, PVC coated and stainless steel gauges and fitting construction.",
  },
] as const;

/** Stock sizes and gauges from sheet 1 (used by the 3D model's size picker). */
export const STOCK_DIAMETERS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24] as const;

export function stockGauge(diameter: number) {
  if (diameter <= 9) return { pipe: 26, fitting: 22 };
  if (diameter <= 18) return { pipe: 26, fitting: 24 };
  return { pipe: 24, fitting: 22 };
}

/** Downloadable submittal sheets (header button). Not precached, same as the catalog PDF (docs/ is skipped). */
export const SUBMITTAL_SHEETS = [
  {
    id: "single-wall",
    title: "Single Wall Submittal",
    href: `${base}docs/Single-Wall-Submittal.pdf`,
    fileName: "Single Wall Submittal.pdf",
    sizeLabel: "333 KB",
  },
  {
    id: "double-wall",
    title: "Double Wall Submittal",
    href: `${base}docs/Double-Wall-Submittal.pdf`,
    fileName: "Double Wall Submittal.pdf",
    sizeLabel: "320 KB",
  },
] as const;
