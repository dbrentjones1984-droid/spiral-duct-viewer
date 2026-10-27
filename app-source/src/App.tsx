import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { InstallButton } from "@/components/install-button";
import { SubmittalSheetsButton } from "@/components/submittal-sheets";
import { DoubleWallDuctIcon } from "@/components/double-wall-duct-icon";
import { DuctElbowIcon } from "@/components/duct-elbow-icon";
import { SpiralDuctIcon } from "@/components/spiral-duct-icon";
import { SheetPage } from "@/components/sheet-page";
import { FittingsPage } from "@/components/fittings-page";
import { HOME_BUTTONS, SHAPES, type HomeButtonId, type Shape } from "@/lib/catalog";
import { goBack, navigate, SWF_BT90_3D_HASH, SWF_CTEE_3D_HASH, SWF_DS90_3D_HASH, SWF_E90_3D_HASH, SWF_LAT_3D_HASH, SWF_LTAP_3D_HASH, SWF_ME90_3D_HASH, SWF_MODELS_HASH, SWF_ROUND_HASH, SWF_TAP_3D_HASH, SWF_TEE_3D_HASH, SW_OVAL_3D_HASH, SW_OVAL_HASH, SW_ROUND_3D_HASH, SW_ROUND_HASH, useHashRoute } from "@/lib/route";
import { SW_OVAL_DOC, SW_ROUND_DOC, SWF_ROUND_DOC } from "@/lib/sheets";

function SingleWallElbowIcon({ className }: { className?: string }) {
  return <DuctElbowIcon className={className} innerWall={false} />;
}

const HOME_ICONS = {
  "single-duct": SpiralDuctIcon,
  "single-fitting": SingleWallElbowIcon,
  "double-duct": DoubleWallDuctIcon,
  "double-fitting": DuctElbowIcon,
} as const;

/** Pages that exist so far. Everything else in the drop-downs just shows its selection for now. */
function pageFor(group: HomeButtonId, shape: Shape) {
  if (group === "single-duct" && shape === "Round") return SW_ROUND_HASH;
  if (group === "single-duct" && shape === "Oval") return SW_OVAL_HASH;
  if (group === "single-fitting" && shape === "Round") return SWF_ROUND_HASH;
  return null;
}

export default function App() {
  const route = useHashRoute();
  // Tab + Round/Oval choice live here so they are still shown when coming back from a sheet page.
  const [group, setGroup] = useState<HomeButtonId | null>(null);
  const [shape, setShape] = useState<Shape | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.page]);

  if (route.page === "sw-round") {
    return (
      <SheetPage
        doc={SW_ROUND_DOC}
        model3d={route.model3d}
        onBack={() => goBack("")}
        onOpen3d={() => navigate(SW_ROUND_3D_HASH)}
        onClose3d={() => goBack(SW_ROUND_HASH)}
      />
    );
  }
  if (route.page === "sw-oval") {
    return (
      <SheetPage
        key="sw-oval"
        doc={SW_OVAL_DOC}
        model3d={route.model3d}
        onBack={() => goBack("")}
        onOpen3d={() => navigate(SW_OVAL_3D_HASH)}
        onClose3d={() => goBack(SW_OVAL_HASH)}
      />
    );
  }
  if (route.page === "swf-round") {
    // Fittings sheets, same page as the duct sheets; View 3D Model opens the list of fitting models.
    return (
      <SheetPage
        key="swf-round"
        doc={SWF_ROUND_DOC}
        model3d={false}
        onBack={() => goBack("")}
        onOpen3d={() => navigate(SWF_MODELS_HASH)}
        onClose3d={() => {}}
      />
    );
  }
  if (route.page === "swf-models") {
    return (
      <FittingsPage
        model3d={route.model3d}
        teeType={route.teeType}
        cteeType={route.cteeType}
        latType={route.latType}
        tapType={route.tapType}
        ltapType={route.ltapType}
        onBack={() => goBack(SWF_ROUND_HASH)}
        onOpen3d={(id) => navigate(id === "ds90" ? SWF_DS90_3D_HASH : id === "me90" ? SWF_ME90_3D_HASH : id === "bt90" ? SWF_BT90_3D_HASH : id === "tee" ? SWF_TEE_3D_HASH : id === "ctee" ? SWF_CTEE_3D_HASH : id === "lat" ? SWF_LAT_3D_HASH : id === "tap" ? SWF_TAP_3D_HASH : id === "ltap" ? SWF_LTAP_3D_HASH : SWF_E90_3D_HASH)}
        onClose3d={() => goBack(SWF_MODELS_HASH)}
      />
    );
  }
  return <CatalogPage group={group} setGroup={setGroup} shape={shape} setShape={setShape} />;
}

function CatalogPage({
  group,
  setGroup,
  shape,
  setShape,
}: {
  group: HomeButtonId | null;
  setGroup: (g: HomeButtonId | null) => void;
  shape: Shape | null;
  setShape: (s: Shape | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabRow = useRef<HTMLDivElement>(null);

  // Closing the drop-down keeps the tab selected only if a shape was picked for it.
  const closeMenu = () => {
    setMenuOpen(false);
    if (!shape) setGroup(null);
  };

  const onTab = (id: HomeButtonId) => {
    if (group === id) {
      if (menuOpen) closeMenu();
      else setMenuOpen(true);
    } else {
      setGroup(id);
      setShape(null);
      setMenuOpen(true);
    }
  };

  // Tap anywhere outside the tab row (or press Escape) to close the drop-down.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!tabRow.current?.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  });

  return (
    <main className="flex min-h-svh flex-col bg-paper text-ink">
      <header className="bg-surface">
        <div className="relative flex justify-center overflow-hidden bg-surface px-4 pt-4 pb-3">
          <img
            src={`${import.meta.env.BASE_URL}blueprint.png`}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <BrandLogo className="relative h-auto w-48 max-w-full sm:w-56" />
          {/* Header buttons on the blueprint, either side of the logo (Brent's sketch): install left, submittals right. */}
          <div className="absolute top-3 left-2 sm:top-4 sm:left-4">
            <InstallButton />
          </div>
          <div className="absolute top-3 right-2 sm:top-4 sm:right-4">
            <SubmittalSheetsButton />
          </div>
        </div>
        <div className="bg-accent px-4 py-2.5 text-center">
          <p className="font-display text-3xl leading-none tracking-wide text-accent-ink">PRODUCT CATALOG</p>
        </div>
        <p className="py-2 text-center text-xs font-medium tracking-widest text-accent">
          ROUND · OVAL · FITTINGS · ACCESSORIES
        </p>
      </header>
      <div ref={tabRow} className="grid grid-cols-4 gap-2 px-3 pt-1 pb-4 sm:gap-3 sm:px-6">
        {HOME_BUTTONS.map((button) => {
          const on = group === button.id;
          const open = on && menuOpen;
          const Icon = HOME_ICONS[button.id];
          const menuId = `shape-menu-${button.id}`;
          return (
            <div key={button.id} className="relative flex">
              <button
                type="button"
                aria-pressed={on}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => onTab(button.id)}
                className="btn-raised flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-card px-1 py-2 text-center"
              >
                <span className="flex h-8 items-center justify-center" aria-hidden="true">
                  <Icon className="h-8 w-auto shrink-0" />
                </span>
                <span className="font-display text-sm leading-none sm:text-base">
                  {button.label.map((line) => (
                    <span key={line} className="block whitespace-nowrap">
                      {line}
                    </span>
                  ))}
                </span>
              </button>
              {open && (
                // Drop-down under the tab (Brent's sketch): a short connector line, then Round / Oval stacked.
                // Absolutely positioned, same width as the tab, so the tab row never shifts.
                <div className="shape-menu absolute inset-x-0 top-full z-20 flex flex-col items-center">
                  <span className="mt-1.5 h-3 w-0.5 rounded-full bg-accent" aria-hidden="true" />
                  <div
                    id={menuId}
                    role="menu"
                    aria-label={`${button.label.join(" ")}: shape`}
                    className="flex w-full flex-col gap-3"
                  >
                    {SHAPES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="menuitemradio"
                        aria-checked={shape === s}
                        onClick={() => {
                          setShape(s);
                          const page = pageFor(button.id, s);
                          if (page) {
                            setMenuOpen(false);
                            navigate(page);
                          }
                        }}
                        className="btn-raised btn-raised-sm flex min-h-11 w-full items-center justify-center rounded-[0.65rem] px-1 font-display text-base leading-none whitespace-nowrap sm:text-lg"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
