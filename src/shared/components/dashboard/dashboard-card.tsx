import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

type DashboardCardAccent = "blue" | "orange" | "red" | "slate";

interface DashboardCardProps {
  accent?: DashboardCardAccent;
  description: string;
  icon: LucideIcon;
  title: string;
}

const accentClasses: Record<DashboardCardAccent, { card: string; icon: string }> = {
  blue: {
    card: "border-blue-200/70 bg-gradient-to-br from-blue-50/70 via-background to-background dark:border-blue-950/80",
    icon: "bg-blue-100/80 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  orange: {
    card: "border-orange-200/70 bg-gradient-to-br from-orange-50/60 via-background to-background dark:border-orange-950/80",
    icon: "bg-orange-100/80 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  },
  red: {
    card: "border-red-200/70 bg-gradient-to-br from-red-50/60 via-background to-background dark:border-red-950/80",
    icon: "bg-red-100/80 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  slate: {
    card: "border-slate-200/70 bg-gradient-to-br from-slate-50/70 via-background to-background dark:border-slate-800",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function DashboardCard({ accent = "slate", description, icon: Icon, title }: DashboardCardProps) {
  const accentStyle = accentClasses[accent];

  return (
    <Card
      className={cn(
        "min-h-48 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md",
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
