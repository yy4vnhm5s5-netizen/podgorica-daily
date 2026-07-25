import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";
import { skeletonClassName } from "./skeleton-classes";

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(skeletonClassName, className)} {...props} />;
}

export { Skeleton };
