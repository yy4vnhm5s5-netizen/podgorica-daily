import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background text-foreground shadow-sm shadow-slate-950/[0.03] dark:shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export { Card, CardContent, CardHeader };
