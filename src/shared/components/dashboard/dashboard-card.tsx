import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

type DashboardCardAccent = "amber" | "emerald" | "red" | "slate";

interface DashboardCardProps {
  accent?: DashboardCardAccent;
  description: string;
  icon: LucideIcon;
  title: string;
}

const accentClasses: Record<DashboardCardAccent, { card: string; icon: string }> = {
  amber: {
    card: "border-amber-200/90 bg-amber-100/70 hover:border-amber-300 dark:border-amber-950/80",
    icon: "bg-amber-200/70 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  emerald: {
    card:
      "border-emerald-200/90 bg-emerald-100/70 hover:border-emerald-300 dark:border-emerald-950/80",
    icon: "bg-emerald-200/70 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  red: {
    card: "border-rose-200/90 bg-rose-100/70 hover:border-rose-300 dark:border-rose-950/80",
    icon: "bg-rose-200/70 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  },
  slate: {
    card: "border-indigo-200/80 bg-indigo-100/55 hover:border-indigo-300 dark:border-slate-800",
    icon: "bg-indigo-200/65 text-indigo-800 dark:bg-slate-800 dark:text-slate-300",
  },
};

function DashboardCard({ accent = "slate", description, icon: Icon, title }: DashboardCardProps) {
  const accentStyle = accentClasses[accent];

  return (
    <Card
      className={cn(
        "min-h-48 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]",
        accentStyle.card,
      )}
    >
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-5 sm:p-6">
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
      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="h-16 rounded-lg border border-dashed bg-background/60" />
        <p className="mt-5 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export { DashboardCard, type DashboardCardAccent, type DashboardCardProps };
