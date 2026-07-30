import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface SectionTitleProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Brand-colored accent mark before the title. On by default — every section header uses it
   * for a consistent scan pattern down the page. Set to `false` for the rare secondary/nested
   * heading directly under another SectionTitle, where a second bar this close would just repeat
   * itself rather than add a new anchor point. */
  accent?: boolean;
  action?: ReactNode;
  as?: "h1" | "h2";
  description?: ReactNode;
  title: ReactNode;
}

function SectionTitle({
  accent = true,
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
      <div className="flex items-start gap-3">
        {accent ? (
          <span aria-hidden="true" className="mt-1 h-5 w-1 shrink-0 rounded-full bg-brand sm:h-6" />
        ) : null}
        <div className="space-y-1.5">
          <Heading
            className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl"
            id={id}
          >
            {title}
          </Heading>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionTitle, type SectionTitleProps };
