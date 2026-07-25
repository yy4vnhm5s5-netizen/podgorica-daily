import type { ComponentProps } from "react";

import { Badge } from "@/shared/components/ui/badge";
import {
  getStatusBadgeToneClassName,
  type StatusTone,
} from "@/shared/components/status-badge-classes";
import { cn } from "@/shared/lib/utils";

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, "variant"> {
  tone?: StatusTone;
}

function StatusBadge({ className, tone = "neutral", ...props }: StatusBadgeProps) {
  return <Badge className={cn(getStatusBadgeToneClassName(tone), className)} {...props} />;
}

export { StatusBadge, type StatusBadgeProps, type StatusTone };
