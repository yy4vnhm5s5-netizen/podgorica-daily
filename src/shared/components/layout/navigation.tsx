import { CalendarDays, LayoutDashboard } from "lucide-react";

import type { Locale } from "@/shared/config/locale";
import type { Translations } from "@/shared/lib/translations";
import { cn } from "@/shared/lib/utils";

interface NavigationProps {
  locale: Locale;
  mobile?: boolean;
  translations: Translations;
}

function Navigation({ locale, mobile = false, translations }: NavigationProps) {
  const navigationItems = [
    {
      href: `/${locale}#dashboard`,
      icon: LayoutDashboard,
      label: translations.shell.navigation.dashboard,
    },
    { href: `/${locale}/events`, icon: CalendarDays, label: translations.shell.navigation.events },
  ];

  return (
    <nav
      aria-label={
        mobile
          ? translations.shell.mobileNavigationLabel
          : translations.shell.primaryNavigationLabel
      }
    >
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

export { Navigation, type NavigationProps };
