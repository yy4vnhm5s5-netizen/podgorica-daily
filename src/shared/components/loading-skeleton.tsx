import type { HTMLAttributes } from "react";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

interface LoadingSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

function LoadingSkeleton({ className, lines = 3, ...props }: LoadingSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading content"
      className={cn("space-y-3", className)}
      role="status"
      {...props}
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} key={index} />
      ))}
      <span className="sr-only">Loading content</span>
    </div>
  );
}

export { LoadingSkeleton, type LoadingSkeletonProps };
