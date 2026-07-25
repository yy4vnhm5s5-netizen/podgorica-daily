import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface SectionTitleProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  action?: ReactNode;
  as?: "h1" | "h2";
  description?: ReactNode;
  title: ReactNode;
}

function SectionTitle({
  action,
  as = "h2",
  className,
  description,
  id,
  title,
  ...props
}: SectionTitleProps) {
  const Heading = as;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div className="space-y-1">
        <Heading className="text-xl font-semibold tracking-tight" id={id}>
          {title}
        </Heading>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionTitle, type SectionTitleProps };
