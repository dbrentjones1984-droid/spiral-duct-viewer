import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { InstallButton } from "@/components/install-button";
import { DoubleWallDuctIcon } from "@/components/double-wall-duct-icon";
import { DuctElbowIcon } from "@/components/duct-elbow-icon";
import { SpiralDuctIcon } from "@/components/spiral-duct-icon";
import { HOME_BUTTONS, type HomeButtonId } from "@/lib/catalog";


function SingleWallElbowIcon({ className }: { className?: string }) {
  return <DuctElbowIcon className={className} innerWall={false} />;
}

const HOME_ICONS = {
  "single-duct": SpiralDuctIcon,
  "single-fitting": SingleWallElbowIcon,
  "double-duct": DoubleWallDuctIcon,
  "double-fitting": DuctElbowIcon,
} as const;

export default function CatalogPage() {
  const [group, setGroup] = useState<HomeButtonId | null>(null);

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
        </div>
        <div className="bg-accent px-4 py-2.5 text-center">
          <p className="font-display text-3xl leading-none tracking-wide text-accent-ink">PRODUCT CATALOG</p>
        </div>
        <p className="py-2 text-center text-xs font-medium tracking-widest text-accent">
          ROUND · OVAL · FITTINGS · ACCESSORIES
        </p>
        <InstallButton />
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
          );
        })}
      </div>
      {/* Drop-down menu for the selected group goes here (planned). */}
    </main>
  );
}
