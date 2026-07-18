import type { PropsWithChildren } from "react";

import { cn } from "@/shared/lib/utils";

interface ResponsiveContainerProps extends PropsWithChildren {
  className?: string;
}

function ResponsiveContainer({ children, className }: ResponsiveContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>
  );
}

export { ResponsiveContainer, type ResponsiveContainerProps };
