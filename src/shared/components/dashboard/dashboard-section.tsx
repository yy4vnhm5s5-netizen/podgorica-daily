import type { PropsWithChildren } from "react";

import { cn } from "@/shared/lib/utils";

type DashboardSectionTone = "cyan" | "neutral" | "violet";

interface DashboardSectionProps extends PropsWithChildren {
  className?: string;
  tone?: DashboardSectionTone;
}

// A light regional surface for a dashboard section. It deliberately sits behind the module cards
// rather than altering them, so every data module keeps its own states, density and hierarchy.
// The divider begins a region; the tint, rounded corners and page spacing provide its quiet end.
const surfaceStyles: Record<DashboardSectionTone, string> = {
  cyan: "bg-cyan-50/[0.24]",
  neutral: "bg-white/[0.34]",
  violet: "bg-violet-50/[0.2]",
};

function DashboardSection({ children, className, tone = "neutral" }: DashboardSectionProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-white/60 p-3 backdrop-blur-[2px] sm:p-4",
        surfaceStyles[tone],
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

export { DashboardSection, type DashboardSectionProps, type DashboardSectionTone };
