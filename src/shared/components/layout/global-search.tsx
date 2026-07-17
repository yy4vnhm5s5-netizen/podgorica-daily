import { Search } from "lucide-react";

function GlobalSearch() {
  return (
    <div aria-label="Global search coming soon" className="relative" id="search" role="status">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <p className="flex h-11 w-full items-center rounded-md border bg-muted/50 pl-10 pr-3 text-sm text-muted-foreground">
        Global search coming soon
      </p>
    </div>
  );
}

export { GlobalSearch };
