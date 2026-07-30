import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface InCardEmptyNoteProps {
  children: ReactNode;
  className?: string;
}

/** A lighter-weight sibling of `EmptyState` for the common "no data right now" line inside an
 * already-bordered card (flights, railway, sea water quality, ...) — same dashed-border family
 * language, without the full title/description/centered layout that only fits a whole section. */
function InCardEmptyNote({ children, className }: InCardEmptyNoteProps) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/30 px-3.5 py-3 text-sm leading-6 text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export { InCardEmptyNote, type InCardEmptyNoteProps };
