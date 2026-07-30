import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background text-foreground shadow-sm shadow-slate-950/[0.03] dark:shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 p-6 sm:p-7", className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0 sm:p-7 sm:pt-0", className)} {...props} />;
}

export { Card, CardContent, CardHeader };
