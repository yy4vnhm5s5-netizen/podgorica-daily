import Image from "next/image";
import Link from "next/link";

import { Navigation } from "@/shared/components/layout/navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { getCityPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";

interface AppHeaderProps {
  city: City;
  homeHref?: string;
  translations: Translations;
}

function AppHeader({ city, homeHref = getCityPath(city), translations }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <ResponsiveContainer className="flex h-16 items-center justify-between gap-4">
        <Link
          aria-label={`${siteConfig.name} – ${translations.shell.navigation.dashboard}`}
          className="focus-visible:ring-ring flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          href={homeHref}
        >
          <Image
            alt=""
            aria-hidden="true"
            className="h-9 w-auto"
            height={316}
            priority
            src={siteConfig.logoMarkPath}
            width={316}
          />
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <Navigation city={city} homeHref={homeHref} translations={translations} />
        </div>
      </ResponsiveContainer>
    </header>
  );
}

export { AppHeader, type AppHeaderProps };
