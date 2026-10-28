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

// Single Wall Duct · Oval: Brent's two "Single Wall Oval Nominal Sizes - Gauge Chart" images, kept as sent (sheet 1 plain,
// sheet 2 shaded rows; a few cells differ and Brent said to keep both as is). Shown the same way as Round (WebP at full
// resolution); the PDF download is both pages in the same order.
export const SW_OVAL_PDF = {
  href: `${base}docs/Spiral-Systems-Single-Wall-Oval-Duct.pdf`,
  fileName: "Spiral-Systems-Single-Wall-Oval-Duct.pdf",
  sizeLabel: "1.0 MB",
};

export const SW_OVAL_SHEETS = [
  {
    n: 1,
    title: "Nominal Sizes · Gauge Chart",
    src: `${base}sheets/single-wall-oval-1.webp`,
    w: 1103,
    h: 1426,
    alt: "Sheet 1, Single Wall Oval, Nominal Sizes Gauge Chart (positive pressure, 1995 SMACNA): initial spiral diameter by oval major axis (8 to 60 inch, 24/22/20/18 gauge) and minor axis (4 to 30 inch).",
  },
  {
    n: 2,
    title: "Nominal Sizes · Gauge Chart (shaded rows)",
    src: `${base}sheets/single-wall-oval-2.webp`,
    w: 1105,
    h: 1423,
    alt: "Sheet 2, Single Wall Oval, Nominal Sizes Gauge Chart with shaded rows (positive pressure, 1995 SMACNA): initial spiral diameter by oval major axis (8 to 60 inch, 24/22/20/18 gauge) and minor axis (4 to 30 inch).",
  },
] as const;

// Single Wall Fittings · Round: Brent's fitting sheets (sheet 1 = catalog page 7 "Gored Elbows", sheet 2 = "Mitered Elbows", sheet 3 = "Bullhead Tees", sheet 4 = "Tees and Crosses", sheet 5 = "Conical Tees and Conical Crosses", sheet 6 = "Laterals", sheet 7 = "Straight and Conical Taps", sheet 8 = "Lateral Taps", sheet 9 = "Concentric and Eccentric Reducer", sheet 10 = "Pipe Coupling and Fitting Coupling, End Cap, Start Collar, End Cap/Plug, Bellmouth"). To add sheets: put the
// images in public/sheets/single-wall-round-fittings-<n>.webp and list them below (the page subtitle counts them), and
// replace public/docs/Spiral-Systems-Single-Wall-Round-Fittings.pdf (and its sizeLabel) with the full PDF.
export const SWF_ROUND_PDF = {
  href: `${base}docs/Spiral-Systems-Single-Wall-Round-Fittings.pdf`,
  fileName: "Spiral-Systems-Single-Wall-Round-Fittings.pdf",
  sizeLabel: "2.1 MB",
};

export const SWF_ROUND_SHEETS = [
  {
    n: 1,
    title: "Gored Elbows",
    src: `${base}sheets/single-wall-round-fittings-1.webp`,
    w: 1140,
    h: 1380,
    alt: "Single Wall Round, Gored Elbows (catalog page 7): E90 90° 5-piece, E60 60° 3-piece, E45 45° 3-piece and E30 30° 2-piece elbows, 2 inch straight ends, standard centerline radius 1-1/2 times diameter (R = 1.5 x A).",
  },
  {
    n: 2,
    title: "Mitered Elbows",
    src: `${base}sheets/single-wall-round-fittings-2.webp`,
    w: 1146,
    h: 1373,
    alt: "Single Wall Round, Mitered Elbows: MEV90 90° 2-piece mitered elbow with vanes (8-9 inch 2 vanes, 10-14 inch 3, 15-19 inch 4, 20-60 inch 5), ME90 90° 2-piece mitered elbow, 3P90 and 3P90H 90° 3-piece elbows; 2 inch collars, 4 inch leg; standard centerline radius 1-1/2 times diameter (R = 1.5 x A).",
  },
  {
    n: 3,
    title: "Bullhead Tees",
    src: `${base}sheets/single-wall-round-fittings-3.webp`,
    w: 1113,
    h: 1414,
    alt: "Single Wall Round, Bullhead Tees: BT90 bullhead tee 90° and BTV90 bullhead tee 90° with vanes; branch A, run outlets B and C with 2 inch ends, body length L = A + 3 inch, reducers R (refer to reducer drawing).",
  },
  {
    n: 4,
    title: "Tees and Crosses",
    src: `${base}sheets/single-wall-round-fittings-4.webp`,
    w: 1132,
    h: 1390,
    alt: "Single Wall Round, Tees and Crosses: T90 tee 90° (L = B + 3 inch), RT90 reducing tee 90° (L = C + 3 inch), C180 cross 180° (L = largest tap + 3 inch) and RC180 reducing cross 180° (L = largest tap + 3 inch); main A, 2 inch ends, reducers R (refer to reducer drawing).",
  },
  {
    n: 5,
    title: "Conical Tees and Conical Crosses",
    src: `${base}sheets/single-wall-round-fittings-5.webp`,
    w: 1124,
    h: 1399,
    alt: "Single Wall Round, Conical Tees and Conical Crosses: CT90 conical tee 90° (L = B + 5 inch), RCT90 reducing conical tee 90° (L = C + 5 inch), CC180 conical cross 180° (L = B + 5 inch, B > C) and RCC180 reducing conical cross 180° (L = C + 5 inch, C > D); main A, conical taps with 2 inch collars and a 5 inch cone, 2 inch ends, reducers R (refer to reducer drawing).",
  },
  {
    n: 6,
    title: "Laterals",
    src: `${base}sheets/single-wall-round-fittings-6.webp`,
    w: 1132,
    h: 1390,
    alt: "Single Wall Round, Laterals: L45 lateral 45° (L = B x 1.414 + 3 inch), RL45 reducing lateral 45° (L = C x 1.414 + 3 inch), LC45 lateral cross 45° (L = B x 1.414 + 3 inch, B > C) and RLC45 reducing lateral cross 45° (L = C x 1.414 + 3 inch, C > D); main A, 45° branches with 2 inch collars, 2 inch ends, reducers R (refer to reducer drawing).",
  },
  {
    n: 7,
    title: "Straight and Conical Taps",
    src: `${base}sheets/single-wall-round-fittings-7.webp`,
    w: 1132,
    h: 1411,
    alt: "Single Wall Round, Straight and Conical Taps: SST90 straight saddle tap 90° and CT90 saddle tap 90° (order by A and P, pipe size; field installed, with a saddle, 1 inch), ST90 tap 90° and CT90 tap 90° (order by A and P; saddle not included; factory or field installed); 5 inch taps with 2 inch ends, the pipe P dashed.",
  },
  {
    n: 8,
    title: "Lateral Taps",
    src: `${base}sheets/single-wall-round-fittings-8.webp`,
    w: 1132,
    h: 1392,
    alt: "Single Wall Round, Lateral Taps: LST45 lateral saddle tap 45° (order by A and P, pipe size; L = C x 1.414 + 3 inch) and LT45 lateral tap 45° (order by A and P; L = C x 1.414; saddle not included; factory or field installed); 45° branches A with 2 inch collars, the pipe P dashed.",
  },
  {
    n: 9,
    title: "Concentric and Eccentric Reducer",
    src: `${base}sheets/single-wall-round-fittings-9.webp`,
    w: 1132,
    h: 1333,
    alt: "Single Wall Round, Concentric and Eccentric Reducer: large end A and small end B, each a 2 inch end, with the reducer R between. CR concentric reducer, R by reduction A - B: 1 to 4 inch R 4, 5 to 8 inch R 8, 9 to 12 inch R 12, 13 to 16 inch R 16. ER eccentric reducer (flat on one side): reduction 1 to 3 inch R 6, else R = (A - B) x 1.5.",
  },
  {
    n: 10,
    title: "Pipe Coupling, Fitting Coupling, End Cap, Start Collar, Bellmouth",
    src: `${base}sheets/single-wall-round-fittings-10.webp`,
    w: 1132,
    h: 1319,
    alt: "Single Wall Round, Pipe Coupling and Fitting Coupling, End Cap, Start Collar, End Cap/Plug, Bellmouth: PC pipe coupling (pipe to pipe connections) and FC fitting coupling (fitting to fitting connections), each a 2 inch band of diameter A; EC end cap, diameter A; SC start collar, a 2 inch collar A with a 1 inch collar (flange) around it; BM bell mouth, 3 inch high, to order list A, B equals A + 4 inch.",
  },
] as const;

const sheetCount = (n: number) => (n === 1 ? "sheet 1" : `sheets 1-${n}`);

/** What a sheet page shows: Round and Oval use the same page. */
export type SheetDoc = {
  title: string;
  subtitle: string;
  sheets: readonly { n: number; title: string; src: string; w: number; h: number; alt: string }[];
  pdf: { href: string; fileName: string; sizeLabel: string };
  /** Which 3D model "View 3D Model" opens ("fittings": the list of fitting models); null = not built yet ("Coming soon"). */
  model: "round" | "oval" | "fittings" | null;
};

export const SW_ROUND_DOC: SheetDoc = {
  title: "SINGLE WALL ROUND",
  subtitle: "Spiral duct · sheets 1-5",
  sheets: SW_ROUND_SHEETS,
  pdf: SW_ROUND_PDF,
  model: "round",
};

export const SW_OVAL_DOC: SheetDoc = {
  title: "SINGLE WALL OVAL",
  subtitle: "Spiral duct · sheets 1-2",
  sheets: SW_OVAL_SHEETS,
  pdf: SW_OVAL_PDF,
  model: "oval",
};

export const SWF_ROUND_DOC: SheetDoc = {
  title: "SINGLE WALL ROUND",
  subtitle: `Fittings · ${sheetCount(SWF_ROUND_SHEETS.length)}`,
  sheets: SWF_ROUND_SHEETS,
  pdf: SWF_ROUND_PDF,
  model: "fittings",
};

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
