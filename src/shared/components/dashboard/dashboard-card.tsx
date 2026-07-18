import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

type DashboardCardAccent = "info" | "neutral" | "warning";

interface DashboardCardProps {
  accent?: DashboardCardAccent;
  description: string;
  icon: LucideIcon;
  title: string;
}

const accentClasses: Record<DashboardCardAccent, { card: string; icon: string }> = {
  info: {
    card: "border-blue-200/80 bg-blue-50/70 hover:border-blue-300",
    icon: "bg-blue-100 text-blue-800",
  },
  neutral: {
    card: "border-slate-200/80 bg-slate-50/80 hover:border-slate-300",
    icon: "bg-slate-100 text-slate-700",
  },
  warning: {
    card: "border-amber-200/80 bg-amber-50/80 hover:border-amber-300",
    icon: "bg-amber-100 text-amber-800",
  },
};

function DashboardCard({ accent = "neutral", description, icon: Icon, title }: DashboardCardProps) {
  const accentStyle = accentClasses[accent];

  return (
    <Card
      className={cn(
        "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]",
        accentStyle.card,
      )}
    >
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            accentStyle.icon,
          )}
        >
          <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export { DashboardCard, type DashboardCardAccent, type DashboardCardProps };
