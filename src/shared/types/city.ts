import type { Locale } from "@/shared/config/locale";

type CityId = string;
type CityNameForm = "accusative" | "genitive" | "locative" | "nominative";

type CityCapability =
  | "electricity"
  | "events"
  | "flights"
  | "goingOut"
  | "railway"
  | "seaWaterQuality"
  | "water"
  | "weather";

interface City {
  accusativeName?: string;
  capabilities?: readonly CityCapability[];
  country: string;
  description?: string;
  /** Required by prepositions such as "iz" — e.g. "Letovi iz Podgorice". */
  genitiveName?: string;
  id: CityId;
  isActive: boolean;
  isMain: boolean;
  latitude: number;
  longitude: number;
  locativeName?: string;
  name: string;
  slug: string;
  timezone: string;
}

interface CityContext {
  city: City;
  locale: Locale;
  timezone: string;
}

export { type City, type CityCapability, type CityContext, type CityId, type CityNameForm };
