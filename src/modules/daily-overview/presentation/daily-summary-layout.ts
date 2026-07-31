const dailySummaryLayout = {
  gridClassName: "relative grid grid-cols-2",
  horizontalDividerClassName: "pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blue-200/70",
  itemClassName: "flex min-h-14 items-center gap-2.5 px-2 py-2.5 sm:px-4",
  // Used only when there are exactly three summary items (the 2x2 grid's dividers only make sense
  // for an even, symmetric count) — three even columns from `sm` up avoids an awkward third item
  // wrapping alone into an otherwise-empty second row of a 2-column grid.
  threeColumnGridClassName: "grid grid-cols-1 gap-x-2 sm:grid-cols-3",
  verticalDividerClassName: "pointer-events-none absolute inset-y-0 left-1/2 w-px bg-blue-200/70",
} as const;

export { dailySummaryLayout };
