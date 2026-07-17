import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
}

function EmptyState({ action, className, description, title, ...props }: EmptyStateProps) {
  return (
    <div className={cn("rounded-lg border border-dashed p-8 text-center", className)} {...props}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };
