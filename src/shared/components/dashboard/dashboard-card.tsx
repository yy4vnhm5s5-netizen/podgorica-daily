import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

type DashboardCardAccent = "blue" | "orange" | "red" | "slate";

interface DashboardCardProps {
  accent?: DashboardCardAccent;
  description: string;
  title: string;
}

const accentClasses: Record<DashboardCardAccent, string> = {
  blue: "border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-background to-background dark:border-blue-950",
  orange:
    "border-orange-200/80 bg-gradient-to-br from-orange-50/80 via-background to-background dark:border-orange-950",
  red: "border-red-200/80 bg-gradient-to-br from-red-50/70 via-background to-background dark:border-red-950",
  slate: "border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-background to-background dark:border-slate-800",
};

function DashboardCard({ accent = "slate", description, title }: DashboardCardProps) {
  return (
    <Card
      className={cn(
        "min-h-48 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accentClasses[accent],
      )}
    >
      <CardHeader className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </CardHeader>
      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="h-16 rounded-lg border border-dashed bg-background/60" />
        <p className="mt-5 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export { DashboardCard, type DashboardCardAccent, type DashboardCardProps };
