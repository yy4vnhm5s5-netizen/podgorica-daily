import { Command } from "lucide-react";

function CommandTrigger() {
  return (
    <div
      aria-label="Command palette coming soon"
      className="hidden h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground sm:flex"
      role="status"
    >
      <Command aria-hidden="true" className="size-4" />
      <span>Command palette coming soon</span>
      <kbd className="ml-3 rounded border px-1.5 py-0.5 text-xs">⌘K</kbd>
    </div>
  );
}

export { CommandTrigger };
