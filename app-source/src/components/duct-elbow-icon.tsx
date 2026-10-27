/**
 * Line-art 90° gored elbow (Brent's reference drawing), drawn to match the duct tab icons: same 60x40
 * viewBox, pipe radius ~ the duct's, same stroke weights (2 for the outer wall and end rings, 1.1 for seams,
 * inner rings and dashes). Collar at each end, two gores in the middle, an inner ring in each open end and
 * dashed lines for the inner wall. Simplified for tab size: front half of each gore seam only.
 * innerWall={false} gives the same drawing without the dashed lines (Single Wall Fittings tab).
 * gores={false} draws a smooth (die-stamped) elbow: no gore seams, curved walls.
 * miter draws a 2-piece mitered elbow: straight walls meeting at a sharp corner, one seam along the 45° cut.
 * tee draws a 90° bullhead tee, front view as on its sheet: straight body, reducers and 2" ends on both run ends,
 * branch out of the bottom with its 2" end, and the branch's arch.
 * cross draws a 180° cross (Tees & Crosses card), front view as on its sheet: straight main with 2" ends, a tap on
 * top and one on the bottom, each with its 2" end and its saddle arch.
 * cross + conical draws a conical cross (Conical Tees & Crosses card): the same main, each tap a 2" collar then a cone
 * flaring wider down to the main, with its saddle arch.
 * lateral draws a 45° lateral cross (Laterals card), front view as on its sheet: straight main with 2" ends, a branch on
 * top and one on the bottom, both at 45° leaning right, each with its beaded 2" collar and its saddle curve.
 * tap draws a straight saddle tap (Straight & Conical Taps card), front view as on its sheet: the 2" beaded collar on a
 * saddle plate, its curved bottom, and the pipe it sits on dashed (shown for reference, not part of the fitting).
 * Path data generated from a 3D model (orthographic projection); uses currentColor.
 */
export function DuctElbowIcon({
  className,
  innerWall = true,
  gores = true,
  miter = false,
  tee = false,
  cross = false,
  conical = false,
  lateral = false,
  tap = false,
}: {
  className?: string;
  innerWall?: boolean;
  gores?: boolean;
  miter?: boolean;
  tee?: boolean;
  cross?: boolean;
  conical?: boolean;
  lateral?: boolean;
  tap?: boolean;
}) {
  if (tap) {
    return (
      <svg viewBox="0 0 60 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {/* the pipe P, dashed: reference only */}
        <path d="M6 20 L16 20 M44 20 L54 20 M6 20 L6 38 M54 20 L54 38 M6 38 L54 38" strokeWidth={1.1} strokeDasharray="2.5 2" />
        {/* collar on the saddle plate */}
        <path d="M22 15 L22 3 L38 3 L38 15 M16 15 L44 15 L44 20 L16 20 Z" strokeWidth={2} />
        {/* bead 2" down from the top, the collar's curved bottom */}
        <path d="M22 7 L38 7 M22 15 A8 3.5 0 0 0 38 15" strokeWidth={1.1} />
      </svg>
    );
  }
  if (lateral) {
    return (
      <svg viewBox="0 0 60 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {/* main with 2" ends, 45° branches top and bottom leaning right (collar end cut square to the branch) */}
        <path d="M4 14 L21.6 14 L31.9 3.7 L38.3 10.1 L34.4 14 L56 14 L56 26 L34.4 26 L38.3 29.9 L31.9 36.3 L21.6 26 L4 26 Z" strokeWidth={2} />
        {/* beads on the ends and the branch collars, the branches' saddle curves */}
        <path d="M9 14 L9 26 M51 14 L51 26 M29.7 5.9 L36.2 12.2 M29.7 34.1 L36.2 27.8 M21.6 14 Q25 19.5 34.4 14 M21.6 26 Q25 20.5 34.4 26" strokeWidth={1.1} />
      </svg>
    );
  }
  if (cross && conical) {
    return (
      <svg viewBox="0 0 60 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {/* main with 2" ends, cone taps top and bottom (collar, then the cone flaring down to the main) */}
        <path d="M4 13 L21 13 L25 6 L25 2 L35 2 L35 6 L39 13 L56 13 L56 27 L39 27 L35 34 L35 38 L25 38 L25 34 L21 27 L4 27 Z" strokeWidth={2} />
        {/* beads on the ends, collar seams, the cones' saddle arches */}
        <path d="M9 13 L9 27 M51 13 L51 27 M25 6 L35 6 M25 34 L35 34 M21 13 A9 5 0 0 0 39 13 M21 27 A9 5 0 0 1 39 27" strokeWidth={1.1} />
      </svg>
    );
  }
  if (cross) {
    return (
      <svg viewBox="0 0 60 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {/* main with 2" ends, taps top and bottom */}
        <path d="M4 13 L22 13 L22 3 L38 3 L38 13 L56 13 L56 27 L38 27 L38 37 L22 37 L22 27 L4 27 Z" strokeWidth={2} />
        {/* beads on the ends, the taps' saddle arches */}
        <path d="M9 13 L9 27 M51 13 L51 27 M22 7 L38 7 M22 33 L38 33 M22 13 A8 5 0 0 0 38 13 M22 27 A8 5 0 0 1 38 27" strokeWidth={1.1} />
      </svg>
    );
  }
  if (tee) {
    return (
      <svg viewBox="0 0 60 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {/* body top, reducers and 2" ends */}
        <path d="M9 10 L16 7 L44 7 L51 10" strokeWidth={2} />
        <path d="M9 22 L16 25 L21 25 L21 37 L39 37 L39 25 L44 25 L51 22" strokeWidth={2} />
        <path d="M9 10 L4 10 L4 22 L9 22 Z M51 10 L56 10 L56 22 L51 22 Z" strokeWidth={2} />
        {/* body seams at the reducers, beads on the ends, the branch's arch */}
        <path d="M16 7 L16 25 M44 7 L44 25 M8 10 L8 22 M52 10 L52 22 M21 34 L39 34 M21 25 A9 9 0 0 1 39 25" strokeWidth={1.1} />
      </svg>
    );
  }
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
        {gores && (
          <>
        {/* gore seams (front half only, simplified from the drawing) */}
        <path d="M16.8 8.7 L17.2 8.7 L17.7 8.8 L18.2 8.9 L18.8 9.2 L19.4 9.4 L19.9 9.8 L20.5 10.2 L21.1 10.7 L21.7 11.3 L21.7 11.3 L22.3 11.9 L22.8 12.6 L23.4 13.3 L23.9 14.1 L24.4 14.9 L24.9 15.8 L25.4 16.6 L25.8 17.5 L26.2 18.4 L26.6 19.3 L26.9 20.2 L27.2 21.1 L27.4 22.0 L27.5 22.8 L27.7 23.6 L27.7 24.4 L27.8 25.2 L27.7 25.9 L27.6 26.5 L27.5 27.1 L27.3 27.6 L27.1 28.1 L26.8 28.5 L26.5 28.8 L26.1 29.1 L25.7 29.2" strokeWidth={1.1} />
        <path d="M29.4 5.8 L29.5 5.9 L29.6 6.0 L29.7 6.3 L29.8 6.6 L29.9 7.0 L30.1 7.5 L30.2 8.0 L30.3 8.6 L30.4 9.3 L30.4 9.3 L30.5 10.0 L30.6 10.8 L30.7 11.6 L30.8 12.5 L30.8 13.4 L30.9 14.4 L31.0 15.3 L31.0 16.3 L31.0 17.3 L31.1 18.2 L31.1 19.2 L31.1 20.2 L31.1 21.1 L31.1 22.0 L31.1 22.8 L31.0 23.6 L31.0 24.4 L30.9 25.1 L30.9 25.8 L30.8 26.3 L30.7 26.8 L30.6 27.3 L30.6 27.6 L30.5 27.9 L30.4 28.1 L30.2 28.2 L30.1 28.2" strokeWidth={1.1} />
        <path d="M42.9 7.9 L42.7 7.9 L42.4 7.9 L42.1 8.0 L41.8 8.1 L41.5 8.4 L41.2 8.7 L40.8 9.1 L40.4 9.6 L40.0 10.1 L39.6 10.7 L39.6 10.7 L39.2 11.4 L38.8 12.1 L38.4 12.8 L38.0 13.6 L37.6 14.5 L37.2 15.3 L36.8 16.2 L36.5 17.1 L36.2 18.1 L35.8 19.0 L35.6 19.9 L35.3 20.8 L35.1 21.7 L34.8 22.6 L34.7 23.4 L34.5 24.2 L34.4 24.9 L34.3 25.6 L34.3 26.3 L34.3 26.9 L34.3 27.4 L34.4 27.8 L34.5 28.2 L34.6 28.5 L34.8 28.8 L35.0 28.9" strokeWidth={1.1} />
          </>
        )}
        {/* outer wall */}
        {/* inner wall, hidden behind the outer one (dashed); left off for the single wall tab */}
        {innerWall && (
          <>
            <path d="M19.4 31.1 L25.1 26.3 L30.1 25.3 L36.2 26.2 L43.2 30.6" strokeWidth={1.1} strokeDasharray="4 3" />
            <path d="M8.9 18.6 L17.0 11.8 L29.4 8.7 L41.7 10.6 L51.8 16.8" strokeWidth={1.1} strokeDasharray="4 3" />
          </>
        )}
        {miter ? (
          <>
            <path d="M21.2 33.3 L30.1 25.8 L41.7 33.1" strokeWidth={2} />
            <path d="M7.1 16.4 L29 1.6 L53.3 14.3" strokeWidth={2} />
            {/* the seam along the 45° cut */}
            <path d="M29 1.6 L30.1 25.8" strokeWidth={1.1} />
          </>
        ) : gores ? (
          <>
            <path d="M21.2 33.3 L26.5 28.8 L30.2 28.2 L35.2 29.0 L41.7 33.1" strokeWidth={2} />
            <path d="M7.1 16.4 L15.6 9.3 L29.3 5.8 L42.7 7.9 L53.3 14.3" strokeWidth={2} />
          </>
        ) : (
          <>
            <path d="M21.2 33.3 Q30.6 23.4 41.7 33.1" strokeWidth={2} />
            <path d="M7.1 16.4 Q29.8 -3.6 53.3 14.3" strokeWidth={2} />
          </>
        )}
        {/* end rings: outer + inner */}
        <path d="M14.8 17.1 L15.5 17.6 L16.3 18.1 L17.0 18.7 L17.7 19.4 L18.3 20.1 L19.0 20.8 L19.6 21.5 L20.1 22.3 L20.6 23.1 L21.1 23.9 L21.5 24.7 L21.8 25.5 L22.1 26.3 L22.4 27.1 L22.5 27.9 L22.7 28.7 L22.7 29.4 L22.7 30.1 L22.6 30.7 L22.4 31.4 L22.2 31.9 L21.9 32.4 L21.6 32.9 L21.2 33.3 L20.8 33.6 L20.3 33.8 L19.7 34.0 L19.1 34.1 L18.5 34.2 L17.8 34.2 L17.1 34.1 L16.4 33.9 L15.7 33.7 L15.0 33.3 L14.2 33.0 L13.5 32.6 L12.7 32.1 L12.0 31.5 L11.3 30.9 L10.6 30.3 L9.9 29.6 L9.3 28.9 L8.7 28.1 L8.1 27.4 L7.6 26.6 L7.2 25.8 L6.8 24.9 L6.4 24.1 L6.1 23.3 L5.9 22.5 L5.7 21.7 L5.6 21.0 L5.6 20.3 L5.6 19.6 L5.7 18.9 L5.8 18.3 L6.0 17.7 L6.3 17.2 L6.7 16.8 L7.1 16.4 L7.5 16.1 L8.0 15.8 L8.6 15.6 L9.1 15.5 L9.8 15.5 L10.4 15.5 L11.1 15.6 L11.8 15.8 L12.5 16.0 L13.3 16.3 L14.0 16.7 L14.8 17.1 Z" strokeWidth={2} />
        <path d="M48.2 16.0 L47.5 16.5 L46.9 17.1 L46.3 17.7 L45.8 18.4 L45.2 19.1 L44.6 19.9 L44.1 20.7 L43.6 21.5 L43.1 22.3 L42.6 23.2 L42.2 24.0 L41.8 24.9 L41.5 25.7 L41.2 26.5 L41.0 27.3 L40.8 28.1 L40.7 28.8 L40.6 29.5 L40.6 30.1 L40.6 30.7 L40.7 31.3 L40.8 31.8 L41.0 32.2 L41.2 32.6 L41.5 32.9 L41.8 33.1 L42.2 33.3 L42.6 33.3 L43.0 33.3 L43.5 33.3 L44.0 33.1 L44.5 32.9 L45.1 32.7 L45.7 32.3 L46.3 31.9 L46.9 31.4 L47.5 30.9 L48.1 30.3 L48.7 29.7 L49.3 29.0 L49.8 28.3 L50.4 27.5 L50.9 26.7 L51.4 25.9 L51.9 25.1 L52.4 24.2 L52.8 23.4 L53.2 22.5 L53.5 21.7 L53.8 20.9 L54.0 20.1 L54.2 19.3 L54.3 18.6 L54.4 17.9 L54.4 17.3 L54.4 16.7 L54.3 16.1 L54.2 15.6 L54.0 15.2 L53.8 14.8 L53.5 14.5 L53.2 14.3 L52.8 14.1 L52.4 14.1 L52.0 14.0 L51.5 14.1 L51.0 14.2 L50.5 14.5 L49.9 14.7 L49.3 15.1 L48.8 15.5 L48.2 16.0 Z" strokeWidth={2} />
        <path d="M14.6 19.0 L15.2 19.3 L15.7 19.7 L16.3 20.2 L16.8 20.7 L17.3 21.2 L17.8 21.7 L18.3 22.3 L18.7 22.9 L19.1 23.5 L19.4 24.1 L19.7 24.7 L20.0 25.4 L20.2 26.0 L20.4 26.6 L20.5 27.2 L20.6 27.8 L20.6 28.3 L20.6 28.8 L20.6 29.3 L20.4 29.8 L20.3 30.2 L20.1 30.6 L19.8 30.9 L19.5 31.2 L19.2 31.5 L18.8 31.7 L18.4 31.8 L17.9 31.9 L17.4 31.9 L16.9 31.9 L16.4 31.8 L15.9 31.7 L15.3 31.5 L14.8 31.3 L14.2 31.0 L13.6 30.7 L13.1 30.3 L12.5 29.9 L12.0 29.5 L11.4 29.0 L10.9 28.5 L10.5 27.9 L10.0 27.3 L9.6 26.8 L9.2 26.1 L8.8 25.5 L8.5 24.9 L8.3 24.3 L8.0 23.7 L7.9 23.1 L7.7 22.5 L7.7 21.9 L7.6 21.3 L7.6 20.8 L7.7 20.3 L7.8 19.9 L8.0 19.4 L8.2 19.1 L8.5 18.7 L8.8 18.4 L9.1 18.2 L9.5 18.0 L9.9 17.8 L10.3 17.8 L10.8 17.7 L11.3 17.7 L11.8 17.8 L12.4 17.9 L12.9 18.1 L13.5 18.3 L14.1 18.6 L14.6 19.0 Z" strokeWidth={1.1} />
        <path d="M48.0 17.8 L47.5 18.2 L47.1 18.7 L46.6 19.2 L46.2 19.7 L45.7 20.2 L45.3 20.8 L44.9 21.4 L44.5 22.0 L44.1 22.7 L43.8 23.3 L43.5 23.9 L43.2 24.6 L43.0 25.2 L42.7 25.8 L42.6 26.4 L42.4 27.0 L42.3 27.6 L42.3 28.1 L42.2 28.6 L42.3 29.1 L42.3 29.5 L42.4 29.8 L42.5 30.2 L42.7 30.4 L42.9 30.7 L43.2 30.8 L43.4 31.0 L43.8 31.0 L44.1 31.0 L44.5 31.0 L44.8 30.9 L45.2 30.7 L45.7 30.5 L46.1 30.2 L46.6 29.9 L47.0 29.6 L47.5 29.2 L47.9 28.7 L48.4 28.2 L48.8 27.7 L49.3 27.2 L49.7 26.6 L50.1 26.0 L50.5 25.4 L50.9 24.7 L51.2 24.1 L51.5 23.5 L51.8 22.8 L52.0 22.2 L52.3 21.6 L52.4 21.0 L52.6 20.4 L52.7 19.8 L52.7 19.3 L52.8 18.8 L52.8 18.3 L52.7 17.9 L52.6 17.6 L52.5 17.2 L52.3 17.0 L52.1 16.7 L51.8 16.6 L51.6 16.4 L51.3 16.4 L50.9 16.4 L50.6 16.4 L50.2 16.5 L49.8 16.7 L49.3 16.9 L48.9 17.2 L48.5 17.5 L48.0 17.8 Z" strokeWidth={1.1} />
    </svg>
  );
}
