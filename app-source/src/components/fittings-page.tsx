import { lazy, Suspense } from "react";
import { Box, ChevronLeft } from "lucide-react";
import { DuctElbowIcon } from "@/components/duct-elbow-icon";

// three.js is only downloaded when a model is opened (it is still precached for offline use).
const GoredElbow3D = lazy(() => import("@/components/gored-elbow-3d"));

/** Fittings shown on the page; more cards get added here as their models are built. */
const FITTINGS = [
  {
    id: "e90",
    name: "Gored 90° Elbow (E90)",
    text: "90° 5-piece gored elbow · centerline radius 1.5 × diameter · 2″ straight ends",
    source: "Catalog page 7 · Gored Elbows",
  },
] as const;

export type FittingId = (typeof FITTINGS)[number]["id"];

/**
 * Single Wall Fittings > Round: the list of fitting models, each card opening its 3D model on top
 * (its own history step, so the phone's back button closes it, same as the sheet pages).
 */
export function FittingsPage({
  model3d,
  onBack,
  onOpen3d,
  onClose3d,
}: {
  model3d: FittingId | null;
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
            aria-label="Back"
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

      <ul className="mx-auto grid w-full max-w-3xl gap-3 px-3 pt-4 pb-8 sm:grid-cols-2">
        {FITTINGS.map((f) => (
          <li key={f.id} className="flex flex-col gap-3 rounded-card border border-[#8e9bab]/60 bg-surface p-3 shadow-[0_2px_10px_rgb(0_28_64/0.12)]">
            <div className="flex items-center gap-3">
              <span className="grid size-20 shrink-0 place-items-center rounded-[0.65rem] bg-paper text-accent ring-1 ring-[#c5d0db]" aria-hidden="true">
                <DuctElbowIcon className="h-12 w-auto" innerWall={false} />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl leading-tight text-accent">{f.name}</h2>
                <p className="text-xs leading-snug text-ink">{f.text}</p>
                <p className="mt-0.5 text-[11px] text-muted">{f.source}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpen3d(f.id)}
              aria-haspopup="dialog"
              aria-label={`View 3D Model: ${f.name}`}
              className="btn-raised btn-raised-sm btn-primary flex h-12 items-center justify-center gap-2 rounded-[0.65rem] font-display text-lg leading-none"
            >
              <Box className="size-5 shrink-0" />
              View 3D Model
            </button>
          </li>
        ))}
        {/* Room for the next fittings (same dashed "coming soon" look as the 3D spot on pages without a model). */}
        <li
          role="note"
          className="flex min-h-24 items-center justify-center rounded-card border-2 border-dashed border-[#8e9bab] bg-surface/60 px-4 text-center font-display text-lg leading-tight text-muted"
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
          <GoredElbow3D onClose={onClose3d} />
        </Suspense>
      )}
    </main>
  );
}
