import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let pdfPromise: Promise<PDFDocumentProxy> | null = null;

function loadPdf() {
  if (pdfPromise) return pdfPromise;
  const pending = import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs.getDocument({ url: `${import.meta.env.BASE_URL}catalogue.pdf`, disableRange: true, disableAutoFetch: true }).promise;
  });
  pending.catch(() => {
    if (pdfPromise === pending) pdfPromise = null;
  });
  pdfPromise = pending;
  return pending;
}

export function CatalogSheet({ page }: { page: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    let lastWidth = -1;
    let generation = 0;

    const paint = async () => {
      const width = Math.max(1, Math.floor(host.clientWidth));
      if (width === lastWidth) return;
      lastWidth = width;
      const gen = ++generation;
      setStatus("loading");
      try {
        const pdf = await loadPdf();
        const sheet = await pdf.getPage(page);
        if (cancelled || gen !== generation) return;
        const base = sheet.getViewport({ scale: 1 });
        const displayScale = width / base.width;
        const viewport = sheet.getViewport({
          scale: displayScale * Math.min(2, window.devicePixelRatio || 1),
        });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = `${Math.round(base.height * displayScale)}px`;
        task?.cancel();
        task = sheet.render({ canvas, viewport });
        await task.promise;
        if (!cancelled && gen === generation) setStatus("ready");
      } catch (error) {
        if (cancelled || gen !== generation) return;
        if (error instanceof Error && error.name === "RenderingCancelledException") return;
        setStatus("error");
      }
    };

    void paint();
    const observer = new ResizeObserver(() => {
      void paint();
    });
    observer.observe(host);
    return () => {
      cancelled = true;
      task?.cancel();
      observer.disconnect();
    };
  }, [page]);

  return (
    <div ref={hostRef} className="bg-surface">
      {status === "loading" ? <p className="px-4 py-6 text-sm text-muted">Opening the sheet…</p> : null}
      {status === "error" ? (
        <p className="px-4 py-6 text-sm text-muted">This sheet did not open. Try another item.</p>
      ) : null}
      <canvas ref={canvasRef} className={status === "ready" ? "block w-full" : "hidden"} />
    </div>
  );
}
