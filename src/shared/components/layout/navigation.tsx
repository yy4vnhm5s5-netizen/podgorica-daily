"use client";

import { House, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isFeatureEnabled } from "@/shared/config/features";
import { isNavigationItemCurrent } from "@/shared/components/layout/navigation-state";
import { getCityPath, getContactPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";
import { cn } from "@/shared/lib/utils";

interface NavigationProps {
  city: City;
  homeHref?: string;
  mobile?: boolean;
  translations: Translations;
}

function Navigation({
  city,
  homeHref = getCityPath(city),
  mobile = false,
  translations,
}: NavigationProps) {
  const pathname = usePathname();
  const navigationItems = [
    {
      href: homeHref,
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
        {navigationItems.map(({ href, icon: Icon, label }) => {
          const isCurrent = isNavigationItemCurrent(pathname, href);

          return (
            <li key={href}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isCurrent
                    ? "bg-brand-soft text-foreground dark:bg-brand/15"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  mobile && "justify-center",
                )}
                href={href}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { Navigation, type NavigationProps };
