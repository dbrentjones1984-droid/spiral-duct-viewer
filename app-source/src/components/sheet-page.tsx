import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Box, ChevronLeft, Download, Minus, Plus } from "lucide-react";
import { SW_ROUND_PDF, SW_ROUND_SHEETS } from "@/lib/sheets";

// three.js is only downloaded when the model is opened (it is still precached for offline use).
const SpiralPipe3D = lazy(() => import("@/components/spiral-pipe-3d"));

const ZOOMS = [1, 1.5, 2, 2.5, 3] as const;

/**
 * Single Wall Duct > Round: Brent's catalog sheets 1-5 as full-resolution images, with Back, View 3D Model,
 * Download PDF and zoom (+/-, plus normal pinch-zoom). The 3D model opens on top as its own history step,
 * so the phone's back button closes it.
 */
export function SheetPage({
  model3d,
  onBack,
  onOpen3d,
  onClose3d,
}: {
  model3d: boolean;
  onBack: () => void;
  onOpen3d: () => void;
  onClose3d: () => void;
}) {
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOMS[zoomIdx];
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);

  // Keep the point in the middle of the screen in place when zooming.
  const changeZoom = (step: number) => {
    const next = Math.min(ZOOMS.length - 1, Math.max(0, zoomIdx + step));
    if (next === zoomIdx) return;
    const el = scroller.current;
    if (el) {
      const doc = document.documentElement;
      anchor.current = {
        x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
        y: (window.scrollY + window.innerHeight / 2) / doc.scrollHeight,
      };
    }
    setZoomIdx(next);
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = a.x * el.scrollWidth - el.clientWidth / 2;
    window.scrollTo(0, a.y * document.documentElement.scrollHeight - window.innerHeight / 2);
  }, [zoomIdx]);

  return (
    <main className="flex min-h-svh flex-col bg-paper text-ink">
      <div className="sticky top-0 z-30 shadow-[0_2px_10px_rgb(0_28_64/0.25)]">
        <header className="flex items-center gap-2 bg-accent px-2 py-2 text-accent-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-white/15 pr-3 pl-1.5 font-display text-base active:bg-white/25"
            aria-label="Back to tabs"
          >
            <ChevronLeft className="size-6" />
            Back
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="font-display text-2xl leading-none tracking-wide whitespace-nowrap">SINGLE WALL ROUND</h1>
            <p className="truncate text-[11px] tracking-wider text-white/80 uppercase">Spiral duct · sheets 1-5</p>
          </div>
          <span className="w-[4.5rem] shrink-0" aria-hidden="true" />
        </header>
        <div className="grid grid-cols-2 gap-2 bg-paper px-3 pt-2.5 pb-3.5">
          <button
            type="button"
            onClick={onOpen3d}
            aria-haspopup="dialog"
            className="btn-raised btn-raised-sm btn-primary flex h-12 items-center justify-center gap-2 rounded-[0.65rem] font-display text-lg leading-none"
          >
            <Box className="size-5 shrink-0" />
            View 3D Model
          </button>
          <a
            href={SW_ROUND_PDF.href}
            download={SW_ROUND_PDF.fileName}
            className="btn-raised btn-raised-sm flex h-12 items-center justify-center gap-2 rounded-[0.65rem] font-display text-lg leading-none"
          >
            <Download className="size-5 shrink-0" />
            <span className="flex flex-col items-start">
              Download PDF
              <span className="font-sans text-[10px] font-medium text-muted">{SW_ROUND_PDF.sizeLabel}</span>
            </span>
          </a>
        </div>
      </div>

      <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
        <div className="flex flex-col gap-4 px-3 pt-1 pb-24" style={{ width: `${zoom * 100}%` }}>
          {SW_ROUND_SHEETS.map((sheet, i) => (
            <figure key={sheet.n} className="m-0">
              <img
                src={sheet.src}
                width={sheet.w}
                height={sheet.h}
                alt={sheet.alt}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={i === 0 ? "high" : "auto"}
                className="block h-auto w-full rounded-md bg-white shadow-[0_2px_10px_rgb(0_28_64/0.18)] ring-1 ring-[#c5d0db]"
              />
              <figcaption className="sticky left-3 mt-1.5 w-max text-xs text-muted">
                Sheet {sheet.n} of {SW_ROUND_SHEETS.length} · {sheet.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div
        className="fixed right-3 z-30 flex items-center overflow-hidden rounded-full border border-[#8e9bab] bg-surface/95 shadow-[0_4px_14px_rgb(0_28_64/0.3)]"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        role="group"
        aria-label="Zoom sheets"
      >
        <button type="button" onClick={() => changeZoom(-1)} disabled={zoomIdx === 0} className="grid size-11 place-items-center disabled:opacity-35" aria-label="Zoom out">
          <Minus className="size-5" />
        </button>
        <span className="w-12 text-center font-display text-base tabular-nums" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={() => changeZoom(1)} disabled={zoomIdx === ZOOMS.length - 1} className="grid size-11 place-items-center disabled:opacity-35" aria-label="Zoom in">
          <Plus className="size-5" />
        </button>
      </div>

      {model3d && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-[#dfe5eb]/95 font-display text-lg text-accent">Loading 3D model…</div>
          }
        >
          <SpiralPipe3D onClose={onClose3d} />
        </Suspense>
      )}
    </main>
  );
}
