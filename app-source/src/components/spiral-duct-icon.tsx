/**
 * Line-art spiral duct (Brent's reference): a cylinder lying at an angle, open end toward the viewer,
 * with slanted spiral seam lines. Drawn horizontally, then tilted up to the right. Uses currentColor
 * so it follows the tab's text color like the other (lucide) icons.
 */
export function SpiralDuctIcon({ className }: { className?: string }) {
  const seams = [20, 26.5, 33, 39.5, 46];
  return (
    <svg
      viewBox="0 0 60 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <g transform="rotate(-22 30 20)">
        {/* body outline */}
        <path d="M10 10 H51" strokeWidth={2} />
        <path d="M10 30 H51" strokeWidth={2} />
        {/* far end */}
        <path d="M51 10 A5 10 0 0 1 51 30" strokeWidth={2} />
        {/* spiral seams */}
        {seams.map((x) => (
          <path key={x} d={`M${x} 10 A4.5 10 0 0 1 ${x} 30`} strokeWidth={1.25} />
        ))}
        {/* rolled lip just behind the open end */}
        <path d="M13.5 10 A5.5 10 0 0 1 13.5 30" strokeWidth={1.25} />
        {/* open end toward the viewer */}
        <ellipse cx={10} cy={20} rx={6} ry={10} strokeWidth={2} />
      </g>
    </svg>
  );
}
