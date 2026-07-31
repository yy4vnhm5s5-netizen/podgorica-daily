import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
  /** Optional leading icon chip for headings that should read as their section's own anchor.
   * When set, the chip itself carries the color signal, so the accent bar is auto-suppressed
   * (both together would be redundant, not richer). */
  icon?: LucideIcon;
  /** Fill/text classes for the icon chip, e.g. "bg-gradient-to-br from-indigo-400 to-indigo-600
   * text-white". Only used when `icon` is set. */
  iconClassName?: string;
  title: ReactNode;
  /** A compact, all-caps treatment for dashboard regions. Other pages retain the display-heading
   * treatment by default. */
  variant?: "dashboard" | "default";
}

function SectionTitle({
  accent = true,
  action,
  as = "h2",
  className,
  description,
  icon: Icon,
  iconClassName,
  id,
  title,
  variant = "default",
  ...props
}: SectionTitleProps) {
  const Heading = as;
  const isDashboard = variant === "dashboard";

  return (
    <div className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div className="flex items-center gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "flex shrink-0 items-center justify-center shadow-sm",
              isDashboard ? "size-9 rounded-xl" : "size-11 rounded-2xl sm:size-12",
              iconClassName,
            )}
          >
            <Icon className="size-5 sm:size-[1.375rem]" strokeWidth={2} />
          </span>
        ) : null}
        <div className="flex items-start gap-3">
          {accent && !Icon ? (
            <span
              aria-hidden="true"
              className="mt-1 h-5 w-1 shrink-0 rounded-full bg-brand sm:h-6"
            />
          ) : null}
          <div className={isDashboard ? "space-y-1" : "space-y-2"}>
            <Heading
              className={cn(
                isDashboard ? "font-medium" : "font-semibold",
                isDashboard
                  ? "text-sm uppercase leading-5 tracking-[0.16em] text-slate-800 sm:text-[0.9375rem]"
                  : "text-xl leading-tight tracking-tight sm:text-2xl",
                // The display serif is reserved for primary/anchor headings — exactly what
                // `accent` already means (see the prop doc above). Serif letterforms read as
                // cramped under the same tight tracking/leading tuned for the sans UI font, so
                // both relax slightly whenever the serif is applied.
                accent && !isDashboard && "font-display font-semibold leading-snug tracking-normal",
              )}
              id={id}
            >
              {title}
            </Heading>
            {description ? (
              <p
                className={cn(
                  "text-muted-foreground",
                  isDashboard ? "text-xs leading-5" : "text-sm leading-6",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionTitle, type SectionTitleProps };
