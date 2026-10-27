import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, ChevronLeft, Download, Maximize, Minus, Plus } from "lucide-react";
import type { SheetDoc } from "@/lib/sheets";

// three.js is only downloaded when the model is opened (it is still precached for offline use).
const SpiralPipe3D = lazy(() => import("@/components/spiral-pipe-3d"));
const OvalPipe3D = lazy(() => import("@/components/oval-pipe-3d"));

/** Zoom steps. "Fit" (the default) shows each whole letter page in the space under the sticky bar, one per screen;
 * "Width" fills the screen width; the % steps are relative to Width. */
const ZOOMS = [
  { label: "Fit", scale: 0 },
  { label: "Width", scale: 1 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2 },
  { label: "300%", scale: 3 },
] as const;
const PAGE_RATIO = 8.5 / 11; // letter, width / height
const CAPTION_H = 26; // caption line under each sheet (incl. gap)
const PILL_W = 200; // floating zoom control incl. its margin, at its widest
const PILL_H = 64;

type Layout = { vw: number; barH: number; availH: number };

/**
 * A sheet page (Single Wall Duct > Round: catalog sheets 1-5; > Oval: the gauge chart) as full-resolution images, with Back, View 3D Model,
 * Download PDF and zoom (Fit / Width / % steps, plus normal pinch-zoom). The 3D model opens on top as its own
 * history step, so the phone's back button closes it.
 */
export function SheetPage({
  doc,
  model3d,
  onBack,
  onOpen3d,
  onClose3d,
}: {
  doc: SheetDoc;
  model3d: boolean;
  onBack: () => void;
  onOpen3d: () => void;
  onClose3d: () => void;
}) {
  const [zoomIdx, setZoomIdx] = useState(0);
  const fit = zoomIdx === 0;
  const scale = ZOOMS[zoomIdx].scale;
  const bar = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const figures = useRef<(HTMLElement | null)[]>([]);
  const anchor = useRef<{ sheet: number; x: number; y: number } | null>(null);
  const [layout, setLayout] = useState<Layout>(() => ({ vw: window.innerWidth, barH: 150, availH: window.innerHeight - 150 }));

  // Measure the space under the sticky header + buttons (changes with rotation and the phone's URL bar).
  useLayoutEffect(() => {
    const measure = () => {
      const barH = Math.round(bar.current?.getBoundingClientRect().height ?? 0);
      const vw = document.documentElement.clientWidth;
      setLayout((l) => (l.vw === vw && l.barH === barH && l.availH === window.innerHeight - barH ? l : { vw, barH, availH: window.innerHeight - barH }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (bar.current) ro.observe(bar.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Opening/closing the 3D model is a history step; don't let the browser jump the sheets to an old scroll spot.
  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = prev;
    };
  }, []);

  // At Fit, snap scrolling so each swipe lands on the next whole sheet.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sheet-bar-h", `${layout.barH}px`);
    root.classList.toggle("snap-sheets", fit);
    return () => {
      root.classList.remove("snap-sheets");
      root.style.removeProperty("--sheet-bar-h");
    };
  }, [fit, layout.barH]);

  // Fit size: the whole letter page inside (screen width x space under the bar), keeping the zoom control clear.
  const fitPage = (() => {
    const { vw, availH } = layout;
    const size = (h: number) => Math.max(120, Math.floor(Math.min(vw - 24, (h - CAPTION_H) * PAGE_RATIO)));
    let w = size(availH - 16);
    const pillClear = (vw - w) / 2 >= PILL_W; // landscape: the page is narrow and the control sits beside it
    if (!pillClear && (availH - (w / PAGE_RATIO + CAPTION_H)) / 2 < PILL_H) w = size(availH - 2 * PILL_H);
    return { w, h: Math.round(w / PAGE_RATIO) };
  })();

  // Which sheet is in the middle of the screen.
  const currentSheet = () => {
    const mid = layout.barH + layout.availH / 2;
    let best = 0;
    let bestD = Infinity;
    figures.current.forEach((f, i) => {
      if (!f) return;
      const r = f.getBoundingClientRect();
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestD) [best, bestD] = [i, d];
    });
    return best;
  };

  const setZoom = (next: number) => {
    next = Math.min(ZOOMS.length - 1, Math.max(0, next));
    if (next === zoomIdx) return;
    const el = scroller.current;
    const root = document.documentElement;
    anchor.current = {
      sheet: currentSheet(),
      x: el ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5,
      y: (window.scrollY + window.innerHeight / 2) / root.scrollHeight,
    };
    setZoomIdx(next);
  };

  // Keep your place when zooming: to/from Fit stays on the same sheet; between % steps keeps the screen centre.
  const prevFit = useRef(fit);
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    const wasFit = prevFit.current;
    prevFit.current = fit;
    if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = a.x * el.scrollWidth - el.clientWidth / 2;
    const fig = figures.current[a.sheet];
    if ((fit || wasFit) && fig) {
      window.scrollTo({ top: fig.getBoundingClientRect().top + window.scrollY - layout.barH - (fit ? 0 : 8), behavior: "instant" });
    } else {
      window.scrollTo({ top: a.y * document.documentElement.scrollHeight - window.innerHeight / 2, behavior: "instant" });
    }
  }, [zoomIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="flex min-h-svh flex-col bg-paper text-ink">
      <div ref={bar} className="sticky top-0 z-30 flex flex-col shadow-[0_2px_10px_rgb(0_28_64/0.25)] short:flex-row short:bg-accent">
        <header
          className="flex items-center gap-2 bg-accent px-2 py-2 text-accent-ink short:min-w-0 short:flex-1"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
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
            <h1 className="font-display text-2xl leading-none tracking-wide whitespace-nowrap">{doc.title}</h1>
            <p className="truncate text-[11px] tracking-wider text-white/80 uppercase">{doc.subtitle}</p>
          </div>
          <span className="w-[4.5rem] shrink-0 short:hidden" aria-hidden="true" />
        </header>
        <div className="grid grid-cols-2 gap-2 bg-paper px-3 pt-2.5 pb-3.5 short:w-[23rem] short:shrink-0 short:bg-accent short:py-2 short:pr-[max(0.75rem,env(safe-area-inset-right))]">
          {doc.model ? (
            <button
              type="button"
              onClick={onOpen3d}
              aria-haspopup="dialog"
              className="btn-raised btn-raised-sm btn-primary flex h-12 items-center justify-center gap-2 rounded-[0.65rem] font-display text-lg leading-none short:h-10"
            >
              <Box className="size-5 shrink-0" />
              View 3D Model
            </button>
          ) : (
            // Spot kept for the 3D model (not built yet): same size and place as View 3D Model, dashed and inactive.
            <div
              role="note"
              aria-label="3D model coming soon"
              className="flex h-12 items-center justify-center gap-2 rounded-[0.65rem] border-2 border-dashed border-[#8e9bab] bg-surface/60 font-display text-lg leading-none text-muted short:h-10"
            >
              <Box className="size-5 shrink-0" />
              <span className="flex flex-col items-start">
                3D Model
                <span className="font-sans text-[10px] font-medium tracking-wider uppercase">Coming soon</span>
              </span>
            </div>
          )}
          <a
            href={doc.pdf.href}
            download={doc.pdf.fileName}
            className="btn-raised btn-raised-sm flex h-12 items-center justify-center gap-2 rounded-[0.65rem] font-display text-lg leading-none short:h-10"
          >
            <Download className="size-5 shrink-0" />
            <span className="flex flex-col items-start">
              Download PDF
              <span className="font-sans text-[10px] font-medium text-muted">{doc.pdf.sizeLabel}</span>
            </span>
          </a>
        </div>
      </div>

      {/* At Fit nothing is wider than the screen, so this is not a scroll box then (the page-level snap needs that). */}
      <div ref={scroller} className={fit ? undefined : "overflow-x-auto overscroll-x-contain"}>
        <div
          className={fit ? "flex flex-col" : "flex flex-col gap-4 px-3 pt-1 pb-24"}
          style={fit ? undefined : { width: `${scale * 100}%` }}
        >
          {doc.sheets.map((sheet, i) => (
            <figure
              key={sheet.n}
              ref={(f) => {
                figures.current[i] = f;
              }}
              className={fit ? "m-0 flex snap-start snap-always flex-col items-center justify-center px-3" : "m-0"}
              style={fit ? { height: layout.availH } : undefined}
            >
              {/* The whole letter page (sheet 5 has a little white margin top and bottom, as in the PDF). */}
              <div
                className="overflow-hidden rounded-md bg-white shadow-[0_2px_10px_rgb(0_28_64/0.18)] ring-1 ring-[#c5d0db]"
                style={fit ? { width: fitPage.w, height: fitPage.h } : { width: "100%", aspectRatio: "8.5 / 11" }}
              >
                <img
                  src={sheet.src}
                  width={sheet.w}
                  height={sheet.h}
                  alt={sheet.alt}
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="block size-full object-contain"
                />
              </div>
              <figcaption
                className={fit ? "mt-1.5 text-center text-xs text-muted" : "sticky left-3 mt-1.5 w-max text-xs text-muted"}
                style={fit ? { width: fitPage.w } : undefined}
              >
                Sheet {sheet.n} of {doc.sheets.length} · {sheet.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div
        className="fixed right-3 z-30 flex items-center gap-2"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        role="group"
        aria-label="Zoom sheets"
      >
        {!fit && (
          <button
            type="button"
            onClick={() => setZoom(0)}
            className="flex h-11 items-center gap-1.5 rounded-full border border-[#8e9bab] bg-surface/95 px-3.5 font-display text-base shadow-[0_4px_14px_rgb(0_28_64/0.3)]"
            aria-label="Fit whole sheet on screen"
          >
            <Maximize className="size-4" />
            Fit
          </button>
        )}
        <div className="flex items-center overflow-hidden rounded-full border border-[#8e9bab] bg-surface/95 shadow-[0_4px_14px_rgb(0_28_64/0.3)]">
          <button type="button" onClick={() => setZoom(zoomIdx - 1)} disabled={fit} className="grid size-11 place-items-center disabled:opacity-35" aria-label="Zoom out">
            <Minus className="size-5" />
          </button>
          <span className="w-14 text-center font-display text-base tabular-nums" aria-live="polite">
            {ZOOMS[zoomIdx].label}
          </span>
          <button
            type="button"
            onClick={() => setZoom(zoomIdx + 1)}
            disabled={zoomIdx === ZOOMS.length - 1}
            className="grid size-11 place-items-center disabled:opacity-35"
            aria-label="Zoom in"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      {model3d && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-[#dfe5eb]/95 font-display text-lg text-accent">Loading 3D model…</div>
          }
        >
          {doc.model === "oval" ? <OvalPipe3D onClose={onClose3d} /> : <SpiralPipe3D onClose={onClose3d} />}
        </Suspense>
      )}
    </main>
  );
}
