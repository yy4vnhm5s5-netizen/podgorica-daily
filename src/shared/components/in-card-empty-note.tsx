import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface InCardEmptyNoteProps {
  children: ReactNode;
  className?: string;
  /** Optional muted icon (typically the same glyph as the card's own header icon) so the note
   * reads as a considered "nothing here right now" state rather than a bare line of text. */
  icon?: LucideIcon;
}

/** A lighter-weight sibling of `EmptyState` for the common "no data right now" line inside an
 * already-bordered card (flights, railway, sea water quality, ...) — same dashed-border family
 * language, without the full title/description/centered layout that only fits a whole section. */
function InCardEmptyNote({ children, className, icon: Icon }: InCardEmptyNoteProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/30 px-3.5 py-3 text-sm leading-6 text-muted-foreground",
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
      ) : null}
      <span>{children}</span>
    </div>
  );
}

export { InCardEmptyNote, type InCardEmptyNoteProps };
