import type { PropsWithChildren } from "react";

import { cn } from "@/shared/lib/utils";

interface DashboardSectionProps extends PropsWithChildren {
  className?: string;
  first?: boolean;
}

// A light regional surface for a dashboard section. It deliberately sits behind the module cards
// rather than altering them, so every data module keeps its own states, density and hierarchy.
function DashboardSection({ children, className, first = false }: DashboardSectionProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border border-white/60 bg-white/[0.34] p-3 shadow-[0_18px_42px_-38px_rgb(15_23_42_/_0.26)] backdrop-blur-[2px] sm:p-4",
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
