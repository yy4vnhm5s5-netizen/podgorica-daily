import { Megaphone } from "lucide-react";

import { Card } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

interface AdvertisingCardProps {
  /**
   * "start" keeps the original single-row banner (icon, title and call to action on one line) and
   * remains the default so the city dashboard placement is unchanged. "center" stacks the same
   * elements — icon above title above description above call to action — for placements that sit
   * in a narrow reading column.
   */
  align?: "center" | "start";
  /**
   * Accessible name for the region. Defaults to the title; supply an explicit one where the title
   * alone does not say the block is promotional.
   */
  ariaLabel?: string;
  /** Optional second line for placements whose title alone does not carry the context. */
  description?: string;
  href: string;
  subtitle: string;
  title: string;
}

function AdvertisingCard({
  align = "start",
  ariaLabel,
  description,
  href,
  subtitle,
  title,
}: AdvertisingCardProps) {
  const isCentered = align === "center";

  return (
    <aside aria-label={ariaLabel ?? title} className="mx-auto w-full max-w-[520px] py-1 sm:py-2">
      <a
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        href={href}
      >
        <Card className="border border-dashed border-indigo-200/80 bg-indigo-50/40 shadow-none transition-[border-color,background-color,box-shadow] hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-sm">
          <div
            className={cn(
              "flex min-h-14 gap-3 px-4 py-2.5 sm:min-h-[4.25rem] sm:px-5",
              isCentered
                ? "flex-col items-center text-center"
                : description
                  ? "items-start"
                  : "items-center",
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700",
                !isCentered && description ? "mt-0.5" : undefined,
              )}
            >
              <Megaphone aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </div>
            <div className={cn("min-w-0", isCentered ? undefined : "flex-1")}>
              <p className="text-sm font-medium tracking-tight text-foreground">{title}</p>
              {description ? (
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-indigo-700 sm:text-sm">
              {subtitle}
            </span>
          </div>
        </Card>
      </a>
    </aside>
  );
}

export { AdvertisingCard, type AdvertisingCardProps };
