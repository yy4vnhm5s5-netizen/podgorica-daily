import type { ComponentProps } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

type StatusTone = "error" | "info" | "neutral" | "success" | "warning";

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, "variant"> {
  tone?: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  error: "border-transparent bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  info: "border-transparent bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  neutral: "border-transparent bg-muted text-muted-foreground",
  success:
    "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
};

function StatusBadge({ className, tone = "neutral", ...props }: StatusBadgeProps) {
  return <Badge className={cn(toneClasses[tone], className)} {...props} />;
}

export { StatusBadge, type StatusBadgeProps, type StatusTone };
