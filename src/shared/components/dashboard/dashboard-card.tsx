import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

type DashboardCardAccent = "info" | "neutral" | "success" | "warning";

interface DashboardCardProps {
  accent?: DashboardCardAccent;
  actionLabel?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}

const accentClasses: Record<DashboardCardAccent, { card: string; fog: string; icon: string }> = {
  info: {
    card: "border-blue-200/80 bg-blue-50/60 hover:border-blue-300",
    fog: "card-fog--info",
    icon: "bg-blue-100/80 text-blue-800",
  },
  neutral: {
    card: "border-slate-200/90 bg-slate-50/65 hover:border-slate-300",
    fog: "card-fog--neutral",
    icon: "bg-slate-100/80 text-slate-700",
  },
  success: {
    card: "border-emerald-200/80 bg-emerald-50/60 hover:border-emerald-300",
    fog: "card-fog--success",
    icon: "bg-emerald-100/80 text-emerald-800",
  },
  warning: {
    card: "border-amber-200/80 bg-amber-50/60 hover:border-amber-300",
    fog: "card-fog--warning",
    icon: "bg-amber-100/80 text-amber-800",
  },
};

function DashboardCard({
  accent = "neutral",
  actionLabel,
  description,
  icon: Icon,
  title,
}: DashboardCardProps) {
  const accentStyle = accentClasses[accent];

  return (
    <Card
      className={cn(
        "card-fog transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]",
        accentStyle.card,
        accentStyle.fog,
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
        {actionLabel ? <p className="mt-3 text-sm font-medium text-primary">{actionLabel}</p> : null}
      </CardContent>
    </Card>
  );
}

export { DashboardCard, type DashboardCardAccent, type DashboardCardProps };
