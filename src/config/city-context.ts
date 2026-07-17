import { env } from "@/config/env";
import { createCityContext, isCityId } from "@/shared/config/cities";
import { defaultLocale, type Locale } from "@/shared/config/locale";

function getDefaultCityContext(locale: Locale = defaultLocale) {
  if (!isCityId(env.DEFAULT_CITY)) {
    throw new Error("DEFAULT_CITY must exist in the city registry.");
  }
  return createCityContext(env.DEFAULT_CITY, locale);
}

export { getDefaultCityContext };
