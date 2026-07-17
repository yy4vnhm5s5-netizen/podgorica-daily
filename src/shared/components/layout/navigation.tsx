import { LayoutDashboard, Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";

const navigationItems = [
  { href: "#dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "#search", icon: Search, label: "Search" },
] as const;

interface NavigationProps {
  mobile?: boolean;
}

function Navigation({ mobile = false }: NavigationProps) {
  return (
    <nav aria-label={mobile ? "Mobile navigation" : "Primary navigation"}>
      <ul className={cn(mobile ? "grid grid-cols-2 gap-2" : "flex items-center gap-1")}>
        {navigationItems.map(({ href, icon: Icon, label }) => (
          <li key={href}>
            <a
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                mobile && "justify-center",
              )}
              href={href}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { Navigation };
