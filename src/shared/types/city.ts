import type { Locale } from "@/shared/config/locale";

type CityId = string;

type CityCapability =
  "electricity" | "events" | "flights" | "goingOut" | "railway" | "trafficAlerts" | "water";

interface City {
  capabilities?: readonly CityCapability[];
  country: string;
  id: CityId;
  isActive: boolean;
  isMain: boolean;
  latitude: number;
  longitude: number;
  name: string;
  slug: string;
  timezone: string;
}

interface CityContext {
  city: City;
  locale: Locale;
  timezone: string;
}

export { type City, type CityCapability, type CityContext, type CityId };
