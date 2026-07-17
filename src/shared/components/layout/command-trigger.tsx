import { Command } from "lucide-react";

interface CommandTriggerProps {
  label: string;
}

function CommandTrigger({ label }: CommandTriggerProps) {
  return (
    <div
      aria-label={label}
      className="hidden h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground sm:flex"
      role="status"
    >
      <Command aria-hidden="true" className="size-4" />
      <span>{label}</span>
      <kbd className="ml-3 rounded border px-1.5 py-0.5 text-xs">⌘K</kbd>
    </div>
  );
}

export { CommandTrigger, type CommandTriggerProps };
