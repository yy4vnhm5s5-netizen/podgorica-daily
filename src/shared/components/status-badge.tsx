import type { ComponentProps } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

type StatusTone = "error" | "info" | "neutral" | "success" | "warning";

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, "variant"> {
  tone?: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  neutral: "border-transparent bg-muted text-muted-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

function StatusBadge({ className, tone = "neutral", ...props }: StatusBadgeProps) {
  return <Badge className={cn(toneClasses[tone], className)} {...props} />;
}

export { StatusBadge, type StatusBadgeProps, type StatusTone };
