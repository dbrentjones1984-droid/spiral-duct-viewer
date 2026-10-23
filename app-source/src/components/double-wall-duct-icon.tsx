/**
 * Line-art double wall duct (Brent's reference): the same tilted cylinder as SpiralDuctIcon, open at
 * both ends, with an inner ring inside each end ring and dashed lines along the body for the inner wall.
 * innerWall={false} gives the same drawing without the dashed lines (used for the Single Wall tab). Uses currentColor.
 */
export function DoubleWallDuctIcon({ className, innerWall = true }: { className?: string; innerWall?: boolean }) {
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
        {/* outer wall */}
        <path d="M10 10 H50" strokeWidth={2} />
        <path d="M10 30 H50" strokeWidth={2} />
        {/* inner wall, hidden behind the outer one (dashed); left off for the single wall tab */}
        {innerWall && (
          <>
            <path d="M15.5 12.6 H45.5" strokeWidth={1.1} strokeDasharray="4 3" />
            <path d="M15.5 27.4 H45.5" strokeWidth={1.1} strokeDasharray="4 3" />
          </>
        )}
        {/* far end: outer ring + inner ring */}
        <ellipse cx={50} cy={20} rx={5.5} ry={10} strokeWidth={2} />
        <ellipse cx={50} cy={20} rx={4.1} ry={7.6} strokeWidth={1.1} />
        {/* near end toward the viewer: outer ring + inner ring */}
        <ellipse cx={10} cy={20} rx={6} ry={10} strokeWidth={2} />
        <ellipse cx={10} cy={20} rx={4.5} ry={7.6} strokeWidth={1.1} />
      </g>
    </svg>
  );
}
