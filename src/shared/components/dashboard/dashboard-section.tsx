import type { PropsWithChildren } from "react";

import { cn } from "@/shared/lib/utils";

interface DashboardSectionProps extends PropsWithChildren {
  className?: string;
}

// A light regional surface for a dashboard section. It deliberately sits behind the module cards
// rather than altering them, so every data module keeps its own states, density and hierarchy.
// The divider begins a region; the tint, rounded corners and page spacing provide its quiet end.
function DashboardSection({ children, className }: DashboardSectionProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-white/60 bg-white/[0.34] p-3 backdrop-blur-[2px] sm:p-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-5 right-5 top-0 h-px bg-slate-900/[0.09] sm:left-6 sm:right-6"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export { DashboardSection, type DashboardSectionProps };
