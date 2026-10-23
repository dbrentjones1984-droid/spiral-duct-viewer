import { useEffect, useRef, useState } from "react";
import { FileDown, FileText, X } from "lucide-react";
import { SUBMITTAL_SHEETS } from "@/lib/sheets";

/** Header button (top-right) that opens a small sheet listing the downloadable submittal PDFs. */
export function SubmittalSheetsButton() {
  const [open, setOpen] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Download submittal sheets"
        className="header-btn btn-raised btn-raised-sm"
      >
        <FileDown className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="font-display text-xs leading-none sm:text-sm">
          <span className="block">Submittal</span>
          <span className="block">Sheets</span>
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-catalog-deep/45" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submittal-title"
            onClick={(e) => e.stopPropagation()}
            className="submittal-sheet relative w-full max-w-md rounded-t-2xl bg-paper px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="submittal-title" className="font-display text-2xl leading-none text-accent">
                  SUBMITTAL SHEETS
                </h2>
                <p className="mt-1 text-xs text-muted">Tap a sheet to download the PDF.</p>
              </div>
              <button
                ref={closeBtn}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="btn-raised btn-raised-sm flex size-10 shrink-0 items-center justify-center rounded-[0.65rem]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-5 flex flex-col gap-4">
              {SUBMITTAL_SHEETS.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.href}
                    download={s.fileName}
                    type="application/pdf"
                    className="btn-raised btn-raised-sm flex min-h-16 items-center gap-3 rounded-card px-4 py-2"
                  >
                    <FileText className="size-7 shrink-0 text-steel" strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-display text-lg leading-tight">{s.title}</span>
                      <span className="text-[11px] font-medium text-muted">PDF · {s.sizeLabel}</span>
                    </span>
                    <FileDown className="size-5 shrink-0 text-accent" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
