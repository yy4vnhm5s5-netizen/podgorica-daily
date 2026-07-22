import { Navigation } from "@/shared/components/layout/navigation";
import type { City } from "@/shared/types/city";
import type { Translations } from "@/shared/lib/translations";

interface MobileNavigationProps {
  city: City;
  translations: Translations;
}

function MobileNavigation({ city, translations }: MobileNavigationProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <Navigation city={city} mobile translations={translations} />
    </div>
  );
}

export { MobileNavigation, type MobileNavigationProps };
