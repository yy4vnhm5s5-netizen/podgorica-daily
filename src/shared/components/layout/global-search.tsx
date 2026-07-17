import { Search } from "lucide-react";

interface GlobalSearchProps {
  label: string;
}

function GlobalSearch({ label }: GlobalSearchProps) {
  return (
    <div aria-label={label} className="relative" id="search" role="status">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <p className="flex h-11 w-full items-center rounded-md border bg-muted/50 pl-10 pr-3 text-sm text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export { GlobalSearch, type GlobalSearchProps };
