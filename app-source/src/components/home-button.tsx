import { House } from "lucide-react";
import { goHome } from "@/lib/route";

/**
 * Home: back to the start page from any page with the blue header (sheet pages, the fitting model lists) and from an
 * open 3D model (it closes the model, since the start page has no 3D panel). Matches the Back pill on the left.
 * - "pill" (page headers): house + "Home" from 400px wide; below that just the house (a round button), so the
 *   centred title (SINGLE WALL ROUND is about 180px) keeps the room it has today at 360.
 * - "round" (3D model header): a round icon button like the Close X next to it.
 */
export function HomeButton({ variant = "pill" }: { variant?: "pill" | "round" }) {
  if (variant === "round") {
    return (
      <button type="button" onClick={goHome} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 active:bg-white/25" aria-label="Home: back to the start page">
        <House className="size-5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={goHome}
      className="flex size-10 shrink-0 items-center justify-center gap-1 rounded-full bg-white/15 font-display text-base active:bg-white/25 min-[400px]:w-auto min-[400px]:pr-3 min-[400px]:pl-2.5"
      aria-label="Home: back to the start page"
    >
      <House className="size-5 shrink-0" />
      <span className="hidden min-[400px]:inline">Home</span>
    </button>
  );
}

/** The header's two side slots are the same width (Back left, Home right) so the title stays centred. */
export const HEADER_SLOT = "flex w-[4.5rem] shrink-0 min-[400px]:w-[5.75rem]";
