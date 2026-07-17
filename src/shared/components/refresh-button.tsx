"use client";

import { RefreshCw } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface RefreshButtonProps extends Omit<ComponentProps<typeof Button>, "children" | "onClick"> {
  isRefreshing?: boolean;
  label: string;
  onRefresh: () => void;
}

function RefreshButton({
  className,
  isRefreshing = false,
  label,
  onRefresh,
  ...props
}: RefreshButtonProps) {
  return (
    <Button
      aria-label={label}
      className={className}
      disabled={isRefreshing || props.disabled}
      onClick={onRefresh}
      type="button"
      variant="outline"
      {...props}
    >
      <RefreshCw aria-hidden="true" className={cn("size-4", isRefreshing && "animate-spin")} />
      {label}
    </Button>
  );
}

export { RefreshButton, type RefreshButtonProps };
