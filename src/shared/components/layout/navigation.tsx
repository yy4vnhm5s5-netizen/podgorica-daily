import { House, Mail } from "lucide-react";
import Link from "next/link";

import { isFeatureEnabled } from "@/shared/config/features";
import { getCityPath, getContactPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";
import { cn } from "@/shared/lib/utils";

interface NavigationProps {
  city: City;
  mobile?: boolean;
  translations: Translations;
}

function Navigation({ city, mobile = false, translations }: NavigationProps) {
  const navigationItems = [
    {
      href: getCityPath(city),
      icon: House,
      label: translations.shell.navigation.dashboard,
    },
    ...(isFeatureEnabled("contact")
      ? [{ href: getContactPath(), icon: Mail, label: translations.shell.navigation.contact }]
      : []),
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
            <Link
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                mobile && "justify-center",
              )}
              href={href}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { Navigation, type NavigationProps };
