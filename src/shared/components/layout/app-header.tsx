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
  translations: Translations;
}

function AppHeader({ city, translations }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <ResponsiveContainer className="flex h-16 items-center justify-between gap-4">
        <Link
          aria-label={siteConfig.name}
          className="focus-visible:ring-ring shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          href={getCityPath(city)}
        >
          <span aria-hidden="true" className="flex h-9 w-[136px] items-center overflow-hidden">
            <span className="relative h-9 w-8 shrink-0 overflow-hidden">
              <Image
                alt=""
                className="absolute left-0 top-0 h-9 w-auto max-w-none"
                height={140}
                priority
                src={siteConfig.logoPath}
                width={530}
              />
            </span>
            <span className="relative ml-0.5 h-9 w-[77px] shrink-0 overflow-hidden">
              <Image
                alt=""
                className="absolute -left-[57px] top-0 h-9 w-auto max-w-none"
                height={140}
                src={siteConfig.logoPath}
                width={530}
              />
            </span>
          </span>
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <Navigation city={city} translations={translations} />
        </div>
      </ResponsiveContainer>
    </header>
  );
}

export { AppHeader, type AppHeaderProps };
