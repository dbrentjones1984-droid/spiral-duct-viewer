import { lazy, Suspense } from "react";
import { Box, ChevronLeft } from "lucide-react";
import { DuctElbowIcon } from "@/components/duct-elbow-icon";
import type { CapType, CteeType, LatType, LtapType, RedType, TapType, TeeType, WyeType, OsType, HangerType, GrilleType } from "@/lib/route";

// three.js is only downloaded when a model is opened (it is still precached for offline use).
const GoredElbow3D = lazy(() => import("@/components/gored-elbow-3d"));

/** Fittings shown on the page; more cards get added here as their models are built. */
const FITTINGS = [
  {
    id: "e90",
    name: "Gored 90° Elbow (E90)",
    text: "90° 5-piece gored elbow · R = 1.5 × diameter · 2″ straight ends",
    source: "Catalog page 7 · Gored Elbows",
    gores: true,
  },
  {
    id: "ds90",
    name: "Die-Stamped 90° Elbow",
    text: "Smooth stamped elbow · R = 1.5 × diameter · 2″ straight ends",
    source: "Sizes 3″–10″ · seamed throat and heel",
    gores: false,
  },
  {
    id: "me90",
    name: "Mitered 90° Elbow (ME90 / MEV90)",
    text: "90° 2-piece mitered elbow · optional turning vanes",
    source: "Mitered Elbows",
    gores: false,
    miter: true,
  },
  {
    id: "bt90",
    name: "Bullhead Tee 90° (BT90 / BTV90)",
    text: "90° bullhead tee · L = A + 3″ · B/C reducers · optional vanes",
    source: "Bullhead Tees",
    gores: false,
    tee: true,
  },
  {
    id: "tee",
    name: "Tees & Crosses",
    text: "T90 / RT90 / C180 / RC180 · taps on the main, reducers on RT90/RC180",
    source: "Tees and Crosses · L = largest tap + 3″",
    gores: false,
    cross: true,
  },
  {
    id: "ctee",
    name: "Conical Tees & Crosses",
    text: "CT90 / RCT90 / CC180 / RCC180 · cone taps, reducers on the R types",
    source: "Conical Tees & Crosses · L = top tap + 5″",
    gores: false,
    cross: true,
    conical: true,
  },
  {
    id: "lat",
    name: "Laterals",
    text: "L45 / RL45 / LC45 / RLC45 · 45° branches, reducers on the R types",
    source: "Laterals · L = top branch × 1.414 + 3″",
    gores: false,
    lateral: true,
  },
  {
    id: "tap",
    name: "Straight & Conical Taps",
    text: "SST90 / CT90 saddle taps, ST90 / CT90 taps · 5″ collars on pipe P",
    source: "Straight and Conical Taps · order by A and P",
    gores: false,
    tap: true,
  },
  {
    id: "ltap",
    name: "Lateral Taps",
    text: "LST45 saddle tap, LT45 tap · 45° branches A on pipe P",
    source: "Lateral Taps · L = A × 1.414 (+3″ saddle)",
    gores: false,
    ltap: true,
  },
  {
    id: "red",
    name: "Reducers",
    text: "CR concentric / ER eccentric · large end A to small end B",
    source: "Reducers · R by reduction A − B",
    gores: false,
    red: true,
  },
  {
    id: "cap",
    name: "Couplings, Caps & Collars",
    text: "PC / FC couplings · EC cap · SC collar · BM bellmouth",
    source: "Couplings & caps · one size A",
    gores: false,
    cap: true,
  },
  {
    id: "wye",
    name: "Wye & Reducing Wye",
    text: "Y45 wye / RY45 reducing wye · two 45° legs off inlet A",
    source: "Wyes · RY45 R by the reducer table",
    gores: false,
    wye: true,
  },
  {
    id: "os",
    name: "Offset & Square to Round",
    text: "OS offset (L = A × 2) / SQ2RD square-to-round transition",
    source: "Offsets · SQ2RD L by the H/W − A table",
    gores: false,
    os: true,
  },
  {
    id: "hanger",
    name: "Clam Shell Hangers",
    text: "Whole (two halves) / Half (bottom U) · 2″ ears, 7/16″ holes · rod not included",
    source: "Strap width & gauge by pipe size · 3″–64″",
    gores: false,
    hanger: true,
  },
  {
    id: "grille",
    name: "Grille Taps",
    text: "GT (no saddle) / GTS (1″ saddle) field installed · GTI factory installed on pipe",
    source: "Order by W × H and pipe size",
    gores: false,
    grille: true,
  },
] as const;

export type FittingId = (typeof FITTINGS)[number]["id"];

/**
 * Single Wall Fittings > Round > View 3D Model: the list of fitting models, each card opening its 3D model on top
 * (its own history step, so the phone's back button closes it, same as the sheet pages).
 */
export function FittingsPage({
  model3d,
  teeType,
  cteeType,
  latType,
  tapType,
  ltapType,
  redType,
  capType,
  wyeType,
  osType,
  hangerType,
  grilleType,
  onBack,
  onOpen3d,
  onClose3d,
}: {
  model3d: FittingId | null;
  teeType?: TeeType;
  cteeType?: CteeType;
  latType?: LatType;
  tapType?: TapType;
  ltapType?: LtapType;
  redType?: RedType;
  capType?: CapType;
  wyeType?: WyeType;
  osType?: OsType;
  hangerType?: HangerType;
  grilleType?: GrilleType;
  onBack: () => void;
  onOpen3d: (id: FittingId) => void;
  onClose3d: () => void;
}) {
  return (
    <main className="flex min-h-svh flex-col bg-paper text-ink">
      <div className="sticky top-0 z-30 shadow-[0_2px_10px_rgb(0_28_64/0.25)]">
        <header className="flex items-center gap-2 bg-accent px-2 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-white/15 pr-3 pl-1.5 font-display text-base active:bg-white/25"
            aria-label="Back to fitting sheets"
          >
            <ChevronLeft className="size-6" />
            Back
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="font-display text-2xl leading-none tracking-wide whitespace-nowrap">3D MODELS</h1>
            <p className="truncate text-[11px] tracking-wider text-white/80 uppercase">Single wall round fittings</p>
          </div>
          <span className="w-[4.5rem] shrink-0" aria-hidden="true" />
        </header>
      </div>

      {/* Uniform cards: every row is the same height (auto-rows-fr + stretch), each card is a flex column with the
          button pinned to the bottom, and the text lines have fixed slots (1-line title, 2-line description,
          1-line detail) so titles, descriptions and buttons line up across cards. */}
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 auto-rows-fr items-stretch gap-3 px-3 pt-4 pb-8 sm:grid-cols-2">
        {FITTINGS.map((f) => (
          <li key={f.id} className="flex h-full flex-col gap-3 rounded-card border border-[#8e9bab]/60 bg-surface p-3 shadow-[0_2px_10px_rgb(0_28_64/0.12)]">
            <div className="flex items-start gap-3">
              <span className="grid size-20 shrink-0 place-items-center rounded-[0.65rem] bg-paper text-accent ring-1 ring-[#c5d0db]" aria-hidden="true">
                <DuctElbowIcon className="h-12 w-auto" innerWall={false} gores={f.gores} miter={"miter" in f && f.miter} tee={"tee" in f && f.tee} cross={"cross" in f && f.cross} conical={"conical" in f && f.conical} lateral={"lateral" in f && f.lateral} tap={"tap" in f && f.tap} ltap={"ltap" in f && f.ltap} red={"red" in f && f.red} cap={"cap" in f && f.cap} wye={"wye" in f && f.wye} os={"os" in f && f.os} hanger={"hanger" in f && f.hanger} grille={"grille" in f && f.grille} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl leading-tight text-accent">{f.name}</h2>
                <p className="line-clamp-2 min-h-[2lh] text-xs leading-snug text-ink">{f.text}</p>
                <p className="mt-0.5 truncate text-[11px] leading-snug text-muted">{f.source}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpen3d(f.id)}
              aria-haspopup="dialog"
              aria-label={`View 3D Model: ${f.name}`}
              className="btn-raised btn-raised-sm btn-primary mt-auto flex h-12 items-center justify-center gap-2 rounded-[0.65rem] font-display text-lg leading-none"
            >
              <Box className="size-5 shrink-0" />
              View 3D Model
            </button>
          </li>
        ))}
        {/* Room for the next fittings (same dashed "coming soon" look as the 3D spot on pages without a model). */}
        <li
          role="note"
          className="flex h-full items-center justify-center rounded-card border-2 border-dashed border-[#8e9bab] bg-surface/60 p-3 text-center font-display text-lg leading-tight text-muted"
        >
          <span className="flex flex-col items-center">
            More fittings
            <span className="font-sans text-[10px] font-medium tracking-wider uppercase">Coming soon</span>
          </span>
        </li>
      </ul>

      {model3d && (
        <Suspense
          fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-[#dfe5eb]/95 font-display text-lg text-accent">Loading 3D model…</div>}
        >
          {model3d === "grille" ? (
            <GoredElbow3D key={`grille-${grilleType}`} kind="grille" teeType={grilleType} onClose={onClose3d} />
          ) : model3d === "hanger" ? (
            <GoredElbow3D key={`hanger-${hangerType}`} kind="hanger" teeType={hangerType} onClose={onClose3d} />
          ) : model3d === "os" ? (
            <GoredElbow3D key={`os-${osType}`} kind="os" teeType={osType} onClose={onClose3d} />
          ) : model3d === "wye" ? (
            <GoredElbow3D key={`wye-${wyeType}`} kind="wye" teeType={wyeType} onClose={onClose3d} />
          ) : model3d === "cap" ? (
            <GoredElbow3D key={`cap-${capType}`} kind="cap" teeType={capType} onClose={onClose3d} />
          ) : model3d === "red" ? (
            <GoredElbow3D key={`red-${redType}`} kind="red" teeType={redType} onClose={onClose3d} />
          ) : model3d === "ltap" ? (
            <GoredElbow3D key={`ltap-${ltapType}`} kind="ltap" teeType={ltapType} onClose={onClose3d} />
          ) : model3d === "tap" ? (
            <GoredElbow3D key={`tap-${tapType}`} kind="tap" teeType={tapType} onClose={onClose3d} />
          ) : model3d === "lat" ? (
            <GoredElbow3D key={`lat-${latType}`} kind="lat" teeType={latType} onClose={onClose3d} />
          ) : model3d === "ctee" ? (
            <GoredElbow3D key={`ctee-${cteeType}`} kind="ctee" teeType={cteeType} onClose={onClose3d} />
          ) : (
            <GoredElbow3D key={model3d === "tee" ? `tee-${teeType}` : model3d} kind={model3d} teeType={teeType} onClose={onClose3d} />
          )}
        </Suspense>
      )}
    </main>
  );
}
