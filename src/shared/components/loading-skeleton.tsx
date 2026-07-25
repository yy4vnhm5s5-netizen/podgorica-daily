import type { HTMLAttributes } from "react";

import { getLoadingSkeletonAccessibilityProps } from "@/shared/components/loading-skeleton-accessibility";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

interface LoadingSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  announce?: boolean;
  label: string;
  lines?: number;
}

function LoadingSkeleton({
  announce = true,
  className,
  label,
  lines = 3,
  ...props
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn("space-y-3", className)}
      {...props}
      {...getLoadingSkeletonAccessibilityProps({ announce, label })}
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} key={index} />
      ))}
      {announce ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

export { LoadingSkeleton, type LoadingSkeletonProps };
