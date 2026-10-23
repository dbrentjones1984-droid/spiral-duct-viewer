import { DoubleWallDuctIcon } from "@/components/double-wall-duct-icon";

/**
 * Single Wall Duct tab icon (Brent: "use the same image for the single wall tab but remove the dotted
 * lines"): the Double Wall cylinder drawing, same size, angle, line weights and end rings, without the
 * dashed inner-wall lines.
 */
export function SpiralDuctIcon({ className }: { className?: string }) {
  return <DoubleWallDuctIcon className={className} innerWall={false} />;
}
