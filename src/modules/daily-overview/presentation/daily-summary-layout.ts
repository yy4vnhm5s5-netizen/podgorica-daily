const dailySummaryLayout = {
  gridClassName: "relative grid grid-cols-2",
  horizontalDividerClassName: "pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blue-200/70",
  itemClassName: "flex min-h-12 items-center gap-2.5 px-2 py-2 sm:px-4",
  verticalDividerClassName: "pointer-events-none absolute inset-y-0 left-1/2 w-px bg-blue-200/70",
} as const;

export { dailySummaryLayout };
