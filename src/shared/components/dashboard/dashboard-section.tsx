import type { PropsWithChildren } from "react";

import { cn } from "@/shared/lib/utils";

interface DashboardSectionProps extends PropsWithChildren {
  className?: string;
  first?: boolean;
}

// A light regional surface for a dashboard section. It deliberately sits behind the module cards
// rather than altering them, so every data module keeps its own states, density and hierarchy.
// Its shadow is intentionally bottom-biased: the divider begins a region, while the small shadow
// below it gives the region a grounded end without making it float above the page.
function DashboardSection({ children, className, first = false }: DashboardSectionProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border border-white/60 bg-white/[0.34] p-3 shadow-[0_18px_24px_-15px_rgb(15_23_42_/_0.22)] backdrop-blur-[2px] sm:p-4",
        first ? "rounded-b-2xl rounded-t-3xl" : "rounded-2xl",
        className,
      )}
    >
      {!first ? (
        <span
          aria-hidden="true"
          className="absolute left-5 right-5 top-0 h-px bg-slate-900/[0.09] sm:left-6 sm:right-6"
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

export { DashboardSection, type DashboardSectionProps };
