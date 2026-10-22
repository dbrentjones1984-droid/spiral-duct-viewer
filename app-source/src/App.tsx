import { useState } from "react";
import { ArrowLeft, Boxes, ChevronRight, Cylinder, Layers, Spline } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CatalogSheet } from "@/components/catalog-sheet";
import { DuctStudio } from "@/components/duct-studio";
import { findSheet, HOME_BUTTONS, sheetsForHome, type HomeButtonId } from "@/lib/catalog";


const HOME_ICONS = {
  "single-duct": Cylinder,
  "single-fitting": Spline,
  "double-duct": Layers,
  "double-fitting": Boxes,
} as const;

export default function CatalogPage() {
  const [group, setGroup] = useState<HomeButtonId | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  if (sheetId) {
    return <SheetPage id={sheetId} onBack={() => setSheetId(null)} />;
  }

  const groups = group ? sheetsForHome(group) : [];

  return (
    <main className="flex h-svh flex-col bg-paper text-ink">
      <header className="bg-surface">
        <div className="relative flex justify-center overflow-hidden bg-surface px-4 pt-4 pb-3">
          <img
            src={`${import.meta.env.BASE_URL}blueprint.png`}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <BrandLogo className="relative h-auto w-48 max-w-full sm:w-56" />
        </div>
        <div className="bg-accent px-4 py-2.5 text-center">
          <p className="font-display text-3xl leading-none tracking-wide text-accent-ink">PRODUCT CATALOG</p>
        </div>
        <p className="py-2 text-center text-xs font-medium tracking-widest text-accent">
          ROUND · OVAL · FITTINGS · ACCESSORIES
        </p>
        <div className="flex justify-center pb-3">
          <a
            href={`${import.meta.env.BASE_URL}spiral-systems-catalog.zip`}
            download="spiral-systems-catalog.zip"
            className="inline-flex h-11 items-center rounded-card bg-accent px-4 text-sm font-medium text-accent-ink"
          >
            Download app copy
          </a>
        </div>
      </header>
      <div className="grid grid-cols-4 gap-2 px-3 pt-1 pb-4 sm:gap-3 sm:px-6">
        {HOME_BUTTONS.map((button) => {
          const on = group === button.id;
          const Icon = HOME_ICONS[button.id];
          return (
            <button
              key={button.id}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(on ? null : button.id)}
              className="btn-raised flex min-h-24 flex-col items-center justify-center gap-1 rounded-card px-1 py-2 text-center"
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="font-display text-sm leading-none sm:text-base">
                {button.label.map((line) => (
                  <span key={line} className="block whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line border-t-4 border-t-accent bg-surface sm:mx-6 sm:mb-6">
        {groups.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6">
            <p className="text-center text-sm text-muted">Choose a group to see the items.</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {groups.map(({ line, sheets }) => (
              <section key={line.id}>
                <h2 className="px-4 pt-4 pb-1 text-xs font-medium tracking-widest text-muted uppercase">{line.title}</h2>
                <ul>
                  {sheets.map((sheet) => (
                    <li key={sheet.id}>
                      <button
                        type="button"
                        onClick={() => setSheetId(sheet.id)}
                        className="flex min-h-14 w-full items-center gap-3 border-b border-line px-4 py-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="font-display text-xl leading-none text-ink">{sheet.title}</span>
                            {sheet.model ? (
                              <span className="text-xs font-medium tracking-widest text-accent uppercase">3D</span>
                            ) : null}
                          </span>
                          <span className="mt-1 block truncate text-sm text-muted">
                            {sheet.items.map((item) => item.code).join(" · ")}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-steel" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SheetPage({ id, onBack, initialMode = "sheet" }: { id: string; onBack: () => void; initialMode?: "sheet" | "model" }) {
  const found = findSheet(id);
  const [mode, setMode] = useState<"sheet" | "model">(initialMode);
  if (!found) {
    return (
      <main className="flex h-svh flex-col bg-paper text-ink">
        <button type="button" onClick={onBack} className="m-4 h-11 rounded-card border border-line bg-surface px-4 text-sm font-medium">
          Back to catalog
        </button>
      </main>
    );
  }
  const { line, sheet } = found;
  const showModel = mode === "model" && sheet.model;

  return (
    <main className="flex h-svh flex-col bg-paper text-ink">
      <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-card border border-line bg-surface px-3 text-sm font-medium text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Home
        </button>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-accent uppercase">{line.title}</p>
          <h1 className="truncate font-display text-2xl leading-none text-ink">{sheet.title}</h1>
        </div>
      </header>
      {sheet.model ? (
        <div className="grid grid-cols-2 gap-2 border-b border-line px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-pressed={mode === "sheet"}
            onClick={() => setMode("sheet")}
            className={
              mode === "sheet"
                ? "h-11 rounded-card bg-accent px-3 text-sm font-medium text-accent-ink"
                : "h-11 rounded-card border border-line bg-surface px-3 text-sm font-medium text-ink"
            }
          >
            Sheet
          </button>
          <button
            type="button"
            aria-pressed={mode === "model"}
            onClick={() => setMode("model")}
            className={
              mode === "model"
                ? "h-11 rounded-card bg-accent px-3 text-sm font-medium text-accent-ink"
                : "h-11 rounded-card border border-line bg-surface px-3 text-sm font-medium text-ink"
            }
          >
            3D model
          </button>
        </div>
      ) : null}
      {showModel ? (
        <div className="min-h-0 flex-1">
          <DuctStudio embedded />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <ul>
            {sheet.items.map((item, index) => (
              <li key={`${item.code}-${index}`} className="flex items-baseline gap-4 border-b border-line px-4 py-3 sm:px-6">
                <span className="font-display text-xl leading-none text-ink">{item.code}</span>
                <span className="text-sm text-muted">{item.name}</span>
              </li>
            ))}
          </ul>
          <CatalogSheet page={sheet.page} />
        </div>
      )}
    </main>
  );
}
