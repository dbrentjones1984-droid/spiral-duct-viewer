export type CatalogItem = {
  code: string;
  name: string;
};

export type CatalogSheet = {
  id: string;
  page: number;
  title: string;
  items: CatalogItem[];
  /** The double-wall straight spiral we already modeled. */
  model?: boolean;
};

export type CatalogLine = {
  id: string;
  title: string;
  sheets: CatalogSheet[];
};

export const CATALOG: CatalogLine[] = [
  {
    id: "single-round",
    title: "Single wall round",
    sheets: [
      {
        id: "sw-dieform",
        page: 8,
        title: "Dieform elbows",
        items: [
          { code: "E90", name: "90° dieform elbow" },
          { code: "E45", name: "45° dieform elbow" },
        ],
      },
      {
        id: "sw-gored",
        page: 9,
        title: "Gored elbows",
        items: [
          { code: "E90", name: "90° 5-piece elbow" },
          { code: "E60", name: "60° 3-piece elbow" },
          { code: "E45", name: "45° 3-piece elbow" },
          { code: "E30", name: "30° 2-piece elbow" },
        ],
      },
      {
        id: "sw-mitered",
        page: 10,
        title: "Mitered elbows",
        items: [
          { code: "MEV90", name: "90° 2-piece mitered elbow with vanes" },
          { code: "ME90", name: "90° 2-piece mitered elbow" },
          { code: "3P90", name: "90° 3-piece elbow" },
          { code: "3P90H", name: "90° 3-piece elbow" },
        ],
      },
      {
        id: "sw-bullhead",
        page: 11,
        title: "Bullhead tees",
        items: [
          { code: "BT90", name: "Bullhead tee 90°" },
          { code: "BTV90", name: "Bullhead tee 90° with vanes" },
        ],
      },
      {
        id: "sw-tees",
        page: 12,
        title: "Tees and crosses",
        items: [
          { code: "T90", name: "Tee 90°" },
          { code: "RT90", name: "Reducing tee 90°" },
          { code: "C180", name: "Cross 180°" },
          { code: "RC180", name: "Reducing cross 180°" },
        ],
      },
      {
        id: "sw-conical-tees",
        page: 13,
        title: "Conical tees and crosses",
        items: [
          { code: "CT90", name: "Conical tee 90°" },
          { code: "RCT90", name: "Reducing conical tee 90°" },
          { code: "CC180", name: "Conical cross 180°" },
          { code: "RCC180", name: "Reducing conical cross 180°" },
        ],
      },
      {
        id: "sw-laterals",
        page: 14,
        title: "Laterals",
        items: [
          { code: "L45", name: "Lateral 45°" },
          { code: "RL45", name: "Reducing lateral 45°" },
          { code: "LC45", name: "Lateral cross 45°" },
          { code: "RLC45", name: "Reducing lateral cross 45°" },
        ],
      },
      {
        id: "sw-conical-laterals",
        page: 15,
        title: "Conical laterals",
        items: [
          { code: "CL45", name: "Conical lateral 45°" },
          { code: "CRL45", name: "Conical reducing lateral 45°" },
          { code: "CLC45", name: "Conical lateral cross 45°" },
          { code: "CRLC45", name: "Conical reducing lateral cross 45°" },
        ],
      },
      {
        id: "sw-taps",
        page: 16,
        title: "Straight and conical taps",
        items: [
          { code: "SST90", name: "Straight saddle tap 90°" },
          { code: "CT90", name: "Saddle tap 90°" },
          { code: "ST90", name: "Tap 90°" },
          { code: "CT90", name: "Tap 90°, saddle not included" },
        ],
      },
      {
        id: "sw-lateral-taps",
        page: 17,
        title: "Lateral taps",
        items: [
          { code: "LST45", name: "Lateral saddle tap 45°" },
          { code: "LT45", name: "Lateral tap 45°" },
        ],
      },
      {
        id: "sw-reducers",
        page: 18,
        title: "Reducers",
        items: [
          { code: "CR", name: "Concentric reducer" },
          { code: "ER", name: "Eccentric reducer" },
        ],
      },
      {
        id: "sw-couplings",
        page: 19,
        title: "Couplings, caps, and bellmouth",
        items: [
          { code: "PC", name: "Pipe coupling" },
          { code: "FC", name: "Fitting coupling" },
          { code: "EC", name: "End cap" },
          { code: "SC", name: "Start collar" },
          { code: "BM", name: "Bellmouth" },
        ],
      },
      {
        id: "sw-wyes",
        page: 20,
        title: "Wyes",
        items: [
          { code: "Y45", name: "Wye 45°" },
          { code: "RY45", name: "Reducing wye 45°" },
        ],
      },
      {
        id: "sw-offset",
        page: 21,
        title: "Offset and square-to-round",
        items: [
          { code: "OS", name: "Offset" },
          { code: "SQ2RD", name: "Square to round transition" },
        ],
      },
      {
        id: "sw-hangers",
        page: 22,
        title: "Clam shell hangers",
        items: [
          { code: "Whole clam", name: "Shell hanger" },
          { code: "Half clam", name: "Shell hanger" },
        ],
      },
      {
        id: "sw-connectors",
        page: 23,
        title: "Access doors and connectors",
        items: [
          { code: "Access door", name: "Insulated access door" },
          { code: "Spiralmate", name: "Duct connection flange" },
          { code: "AccuFlange", name: "Duct connection flange" },
        ],
      },
      {
        id: "sw-grille",
        page: 24,
        title: "Grille taps",
        items: [
          { code: "GT", name: "Grille tap, no saddle" },
          { code: "GTS", name: "Grille tap with 1 in saddle" },
          { code: "GTI", name: "Grille tap installed on pipe" },
        ],
      },
      {
        id: "sw-manifold",
        page: 25,
        title: "Manifold spiral pipe",
        items: [{ code: "Manifold", name: "Manifold spiral pipe" }],
      },
    ],
  },
  {
    id: "double-round",
    title: "Double wall round",
    sheets: [
      {
        id: "dw-pipe",
        page: 29,
        title: "Spiral pipe",
        model: true,
        items: [
          { code: "Solid / solid", name: "Double-wall spiral pipe" },
          { code: "Solid / perforated", name: "Double-wall spiral pipe" },
        ],
      },
      {
        id: "dw-gored",
        page: 32,
        title: "Gored elbows",
        items: [
          { code: "DE90", name: "90° 5-piece elbow" },
          { code: "DE60", name: "60° 3-piece elbow" },
          { code: "DE45", name: "45° 3-piece elbow" },
          { code: "DE30", name: "30° 2-piece elbow" },
        ],
      },
      {
        id: "dw-mitered",
        page: 33,
        title: "Mitered elbows",
        items: [
          { code: "DMEV90", name: "90° 2-piece mitered elbow with vanes" },
          { code: "DME90", name: "90° 2-piece mitered elbow" },
          { code: "D3P90", name: "90° 3-piece elbow" },
          { code: "D3P90H", name: "90° 3-piece elbow" },
        ],
      },
      {
        id: "dw-bullhead",
        page: 34,
        title: "Bullhead tees",
        items: [
          { code: "DBT90", name: "Bullhead tee 90°" },
          { code: "DBTV90", name: "Bullhead tee 90° with vanes" },
        ],
      },
      {
        id: "dw-tees",
        page: 35,
        title: "Tees and crosses",
        items: [
          { code: "DT90", name: "Tee 90°" },
          { code: "DRT90", name: "Reducing tee 90°" },
          { code: "DC180", name: "Cross 180°" },
          { code: "DRC180", name: "Reducing cross 180°" },
        ],
      },
      {
        id: "dw-conical-tees",
        page: 36,
        title: "Conical tees and crosses",
        items: [
          { code: "DCT90", name: "Conical tee 90°" },
          { code: "DRCT90", name: "Reducing conical tee 90°" },
          { code: "DCC180", name: "Conical cross 180°" },
          { code: "DRCC180", name: "Reducing conical cross 180°" },
        ],
      },
      {
        id: "dw-laterals",
        page: 37,
        title: "Laterals",
        items: [
          { code: "DL45", name: "Lateral 45°" },
          { code: "DRL45", name: "Reducing lateral 45°" },
          { code: "DLC45", name: "Lateral cross 45°" },
          { code: "DRLC45", name: "Reducing lateral cross 45°" },
        ],
      },
      {
        id: "dw-conical-laterals",
        page: 38,
        title: "Conical laterals",
        items: [
          { code: "DL45", name: "Lateral 45°" },
          { code: "DRL45", name: "Reducing lateral 45°" },
          { code: "DLC45", name: "Lateral cross 45°" },
          { code: "DRLC45", name: "Reducing lateral cross 45°" },
        ],
      },
      {
        id: "dw-taps",
        page: 39,
        title: "Straight and conical taps",
        items: [
          { code: "DSST90", name: "Straight saddle tap 90°" },
          { code: "DCT90", name: "Saddle tap 90°" },
          { code: "DST90", name: "Tap 90°" },
          { code: "DCT90", name: "Tap 90°, saddle not included" },
        ],
      },
      {
        id: "dw-lateral-taps",
        page: 40,
        title: "Lateral taps",
        items: [
          { code: "DLST45", name: "Lateral saddle tap 45°" },
          { code: "LT45", name: "Lateral tap 45°" },
        ],
      },
      {
        id: "dw-reducers",
        page: 41,
        title: "Reducers",
        items: [
          { code: "DCR", name: "Concentric reducer" },
          { code: "DER", name: "Eccentric reducer" },
        ],
      },
      {
        id: "dw-couplings",
        page: 42,
        title: "Couplings and end cap",
        items: [
          { code: "DPC", name: "Pipe coupling" },
          { code: "DFC", name: "Fitting coupling" },
          { code: "DEC", name: "End cap" },
        ],
      },
      {
        id: "dw-wyes",
        page: 43,
        title: "Wyes",
        items: [
          { code: "DY45", name: "Wye 45°" },
          { code: "DRY45", name: "Reducing wye 45°" },
        ],
      },
      {
        id: "dw-offset",
        page: 44,
        title: "Offset and square-to-round",
        items: [
          { code: "DOS", name: "Offset" },
          { code: "DSQ2RD", name: "Square to round transition" },
        ],
      },
      {
        id: "dw-connectors",
        page: 45,
        title: "Access doors and connectors",
        items: [
          { code: "Access door", name: "Insulated access door" },
          { code: "Spiralmate", name: "Duct connection flange" },
          { code: "AccuFlange", name: "Duct connection flange" },
        ],
      },
      {
        id: "dw-grille",
        page: 46,
        title: "Grille taps",
        items: [
          { code: "GTD", name: "Grille tap, no saddle" },
          { code: "GTSD", name: "Grille tap with 1 in saddle" },
          { code: "GTID", name: "Grille tap installed on pipe" },
        ],
      },
      {
        id: "dw-manifold",
        page: 47,
        title: "Manifolded spiral pipe",
        items: [{ code: "Manifold", name: "Manifolded spiral pipe" }],
      },
    ],
  },
  {
    id: "single-oval",
    title: "Single wall oval",
    sheets: [
      {
        id: "ov-pipe",
        page: 53,
        title: "Spiral and long-seam pipe",
        items: [
          { code: "Spiral", name: "Spiral oval pipe" },
          { code: "Long-seam", name: "Long-seam oval pipe" },
        ],
      },
      {
        id: "ov-elbows",
        page: 54,
        title: "Elbows",
        items: [
          { code: "90HB5", name: "90° 5-piece elbow" },
          { code: "60HB3", name: "60° 3-piece elbow" },
          { code: "45HB3", name: "45° 3-piece elbow" },
          { code: "30HB2", name: "30° 2-piece elbow" },
        ],
      },
      {
        id: "ov-mitered",
        page: 55,
        title: "Mitered elbows",
        items: [
          { code: "O2PV90 H", name: "90° 2-piece mitered elbow with vanes" },
          { code: "O2PV90 E", name: "90° 2-piece mitered elbow with vanes" },
        ],
      },
      {
        id: "ov-hard-easy",
        page: 56,
        title: "Hard bend and easy bend",
        items: [
          { code: "Easy", name: "Easy bend elbow" },
          { code: "Hard", name: "Hard bend elbow" },
        ],
      },
      {
        id: "ov-tees",
        page: 57,
        title: "Tees and crosses",
        items: [
          { code: "OT90", name: "Tee 90°" },
          { code: "ORT90", name: "Reducing tee 90°" },
          { code: "OC180", name: "Cross 180°" },
          { code: "ORC180", name: "Reducing cross 180°" },
        ],
      },
      {
        id: "ov-conical-tees",
        page: 58,
        title: "Conical tees and crosses",
        items: [
          { code: "OCT90", name: "Conical tee 90°" },
          { code: "ORCT90", name: "Reducing conical tee 90°" },
          { code: "OCC180", name: "Conical cross 180°" },
          { code: "ORCC180", name: "Reducing conical cross 180°" },
        ],
      },
      {
        id: "ov-low-loss",
        page: 59,
        title: "Low-loss tees and crosses",
        items: [
          { code: "OT90-L", name: "Tee 90°" },
          { code: "ORT90-L", name: "Reducing tee 90°" },
        ],
      },
      {
        id: "ov-laterals",
        page: 60,
        title: "Laterals",
        items: [
          { code: "OL45", name: "Lateral 45°" },
          { code: "ORL45", name: "Reducing lateral 45°" },
          { code: "OLC45", name: "Lateral cross 45°" },
          { code: "ORLC45", name: "Reducing lateral cross 45°" },
        ],
      },
      {
        id: "ov-reducers",
        page: 61,
        title: "Reducers",
        items: [
          { code: "CR", name: "Concentric reducer" },
          { code: "ER", name: "Eccentric reducer" },
        ],
      },
      {
        id: "ov-wyes",
        page: 62,
        title: "Wyes",
        items: [
          { code: "Y45", name: "Wye 45°" },
          { code: "RY45", name: "Reducing wye 45°" },
        ],
      },
      {
        id: "ov-couplings",
        page: 63,
        title: "Couplings, caps, and bellmouth",
        items: [
          { code: "PC", name: "Pipe coupling" },
          { code: "FC", name: "Fitting coupling" },
          { code: "OEC", name: "Oval end cap" },
          { code: "OF", name: "Oval flange" },
          { code: "BM", name: "Bellmouth" },
        ],
      },
      {
        id: "ov-offset",
        page: 64,
        title: "Offset and square-to-round",
        items: [
          { code: "OS", name: "Offset" },
          { code: "SQ2RD", name: "Square to round transition" },
        ],
      },
    ],
  },
  {
    id: "double-oval",
    title: "Double wall oval",
    sheets: [
      {
        id: "dov-pipe",
        page: 69,
        title: "Spiral and long-seam pipe",
        items: [
          { code: "Spiral", name: "Spiral oval pipe" },
          { code: "Long-seam", name: "Long-seam oval pipe" },
        ],
      },
      {
        id: "dov-elbows",
        page: 70,
        title: "Elbows",
        items: [
          { code: "D90HB5", name: "90° 5-piece elbow" },
          { code: "D60HB3", name: "60° 3-piece elbow" },
          { code: "D45HB3", name: "45° 3-piece elbow" },
          { code: "D30HB2", name: "30° 2-piece elbow" },
        ],
      },
      {
        id: "dov-mitered",
        page: 71,
        title: "Mitered elbows",
        items: [
          { code: "O2PV90 H", name: "90° 2-piece mitered elbow with vanes" },
          { code: "O2PV90 E", name: "90° 2-piece mitered elbow with vanes" },
        ],
      },
      {
        id: "dov-hard-easy",
        page: 72,
        title: "Hard bend and easy bend",
        items: [
          { code: "Easy", name: "Easy bend elbow" },
          { code: "Hard", name: "Hard bend elbow" },
        ],
      },
      {
        id: "dov-tees",
        page: 73,
        title: "Tees and crosses",
        items: [
          { code: "DT90", name: "Tee 90°" },
          { code: "DRT90", name: "Reducing tee 90°" },
          { code: "DC180", name: "Cross 180°" },
          { code: "DRC180", name: "Reducing cross 180°" },
        ],
      },
      {
        id: "dov-conical-tees",
        page: 74,
        title: "Conical tees and crosses",
        items: [
          { code: "DOCT90", name: "Conical tee 90°" },
          { code: "DORCT90", name: "Reducing conical tee 90°" },
          { code: "DOCC180", name: "Conical cross 180°" },
          { code: "DORCC180", name: "Reducing conical cross 180°" },
        ],
      },
      {
        id: "dov-low-loss",
        page: 75,
        title: "Low-loss tees and crosses",
        items: [
          { code: "DOT90L", name: "Low-loss tee 90°" },
          { code: "DORT90L", name: "Reducing tee 90°" },
          { code: "DOT90-L", name: "Tee 90°" },
          { code: "DORT90-L", name: "Reducing tee 90°" },
        ],
      },
      {
        id: "dov-laterals",
        page: 76,
        title: "Laterals",
        items: [
          { code: "DOL45", name: "Lateral 45°" },
          { code: "DORL45", name: "Reducing lateral 45°" },
          { code: "DOLC45", name: "Lateral cross 45°" },
          { code: "DORLC45", name: "Reducing lateral cross 45°" },
        ],
      },
      {
        id: "dov-reducers",
        page: 77,
        title: "Reducers",
        items: [
          { code: "DCR", name: "Concentric reducer" },
          { code: "DER", name: "Eccentric reducer" },
        ],
      },
      {
        id: "dov-wyes",
        page: 78,
        title: "Wyes",
        items: [
          { code: "DY45", name: "Wye 45°" },
          { code: "DRY45", name: "Reducing wye 45°" },
        ],
      },
      {
        id: "dov-offset",
        page: 79,
        title: "Offset and square-to-round",
        items: [
          { code: "OS", name: "Offset" },
          { code: "SQ2RD", name: "Square to round transition" },
        ],
      },
      {
        id: "dov-couplings",
        page: 80,
        title: "Couplings, caps, and bellmouth",
        items: [
          { code: "PC", name: "Pipe coupling" },
          { code: "FC", name: "Fitting coupling" },
          { code: "OEC", name: "Oval end cap" },
          { code: "OF", name: "Oval flange" },
          { code: "BM", name: "Bellmouth" },
        ],
      },
    ],
  },
];

export function findSheet(id: string) {
  for (const line of CATALOG) {
    const sheet = line.sheets.find((entry) => entry.id === id);
    if (sheet) return { line, sheet };
  }
  return null;
}

export const HOME_BUTTONS = [
  { id: "single-duct", label: ["Single Wall", "Duct"] },
  { id: "single-fitting", label: ["Single", "Fitting"] },
  { id: "double-duct", label: ["Double", "Duct"] },
  { id: "double-fitting", label: ["Double", "Fitting"] },
] as const;

export type HomeButtonId = (typeof HOME_BUTTONS)[number]["id"];

export function sheetsForHome(id: HomeButtonId) {
  const single = id.startsWith("single");
  const duct = id.endsWith("duct");
  return CATALOG.filter((line) => (single ? line.id.startsWith("single") : line.id.startsWith("double")))
    .map((line) => ({
      line,
      sheets: line.sheets.filter((sheet) => /pipe/i.test(sheet.title) === duct),
    }))
    .filter((group) => group.sheets.length > 0);
}
