import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface SectionTitleProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  action?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

function SectionTitle({ action, className, description, title, ...props }: SectionTitleProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionTitle, type SectionTitleProps };
