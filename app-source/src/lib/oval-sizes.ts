/*
 * Single Wall Oval, sheets 1-2 "Nominal Sizes - Gauge Chart" (positive pressure, 1995 SMACNA), as data.
 * Rows: initial spiral diameter D (the round pipe the oval is formed from) and its gauge band; columns: minor axis α;
 * cells: the major axis A it makes. Each row is [D, first minor axis in the row, majors for α = first, first + 2, ...].
 * (Sheet 1 prints 79 for D 60 / α 28, the same as α 26; sheet 2 and the perimeter math give 78, used here.)
 */
const ROWS: readonly (readonly [number, number, readonly number[]])[] = [
  [8, 4, [10]],
  [9, 4, [12, 11]],
  [10, 4, [13, 12, 11]],
  [11, 4, [15, 14, 13]],
  [12, 4, [17, 15, 14, 13]],
  [13, 4, [18, 17, 16, 15, 14]],
  [14, 4, [20, 19, 17, 16, 15]],
  [15, 4, [21, 20, 19, 18, 17, 16]],
  [16, 4, [23, 22, 21, 19, 18, 17]],
  [17, 4, [24, 23, 22, 21, 20, 19, 18]],
  [18, 4, [26, 25, 24, 23, 21, 20, 19]],
  [19, 4, [28, 26, 25, 24, 23, 22, 21]],
  [20, 4, [29, 28, 27, 26, 25, 23, 22, 21]],
  [21, 4, [31, 30, 28, 27, 26, 25, 24, 23]],
  [22, 4, [32, 31, 30, 29, 28, 27, 25, 24]],
  [23, 6, [33, 32, 30, 29, 28, 27, 26, 25]],
  [24, 6, [34, 33, 32, 31, 30, 29, 27, 26]],
  [26, 6, [37, 36, 35, 34, 33, 32, 31, 29, 28]],
  [28, 8, [39, 38, 37, 36, 35, 34, 33, 31, 30]],
  [30, 8, [43, 41, 40, 39, 38, 37, 36, 35, 33, 32]],
  [32, 8, [46, 45, 43, 42, 41, 40, 39, 38, 37, 35, 34]],
  [34, 8, [49, 48, 47, 45, 44, 43, 42, 41, 40, 39, 37, 36]],
  [36, 10, [51, 50, 49, 47, 46, 45, 44, 43, 42, 41, 39]],
  [38, 10, [54, 53, 52, 51, 49, 48, 47, 46, 45, 44, 43]],
  [40, 10, [57, 56, 55, 54, 53, 51, 50, 49, 48, 47, 46]],
  [42, 10, [60, 59, 58, 57, 56, 55, 53, 52, 51, 50, 49]],
  [44, 10, [63, 62, 61, 60, 59, 58, 57, 55, 54, 53, 52]],
  [46, 10, [67, 66, 64, 63, 62, 61, 60, 59, 57, 56, 55]],
  [48, 10, [70, 69, 67, 66, 65, 64, 63, 62, 61, 59, 58]],
  [50, 10, [73, 72, 71, 69, 68, 67, 66, 65, 64, 63, 61]],
  [52, 10, [76, 75, 74, 73, 71, 70, 69, 68, 67, 66, 65]],
  [54, 12, [78, 77, 76, 75, 73, 72, 71, 70, 69, 68]],
  [56, 12, [81, 80, 79, 78, 77, 75, 74, 73, 72, 71]],
  [58, 14, [83, 82, 81, 80, 79, 77, 76, 75, 74]],
  [60, 16, [85, 84, 83, 82, 81, 79, 78, 77]],
];

/** Gauge by initial spiral diameter, from the chart's bands. */
export const ovalGaugeForD = (D: number) => (D <= 17 ? 24 : D <= 22 ? 22 : D <= 46 ? 20 : 18);

export type OvalSize = { A: number; a: number; D: number; gauge: number };

/** Every A x α on the chart, with its spiral diameter and gauge. */
export const OVAL_SIZES: readonly OvalSize[] = ROWS.flatMap(([D, a0, majors]) =>
  majors.map((A, i) => ({ A, a: a0 + 2 * i, D, gauge: ovalGaugeForD(D) })),
);

/** Major axes on the chart (8" spiral and up: 10" to 85"). */
export const OVAL_MAJORS: readonly number[] = [...new Set(OVAL_SIZES.map((s) => s.A))].sort((x, y) => x - y);

/** Minor axes listed for a major axis A. */
export const ovalMinorsFor = (A: number) => OVAL_SIZES.filter((s) => s.A === A).map((s) => s.a).sort((x, y) => x - y);

export const ovalSize = (A: number, a: number) => OVAL_SIZES.find((s) => s.A === A && s.a === a) ?? null;
