import type { Locale } from "@/shared/config/locale";

import type { WeatherConditionKey } from "@/modules/weather/domain/current-weather";

interface WeatherTranslations {
  airQuality: string;
  airQualityCategories: Record<"good" | "moderate" | "unhealthy", string>;
  conditions: Record<WeatherConditionKey, string>;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  feelsLike: string;
  humidity: string;
  lastUpdated: string;
  loading: string;
  location: string;
  source: string;
  status: string;
  title: string;
  wind: string;
}

const weatherTranslations: Record<Locale, WeatherTranslations> = {
  en: {
    airQuality: "Air quality",
    airQualityCategories: { good: "Good", moderate: "Moderate", unhealthy: "Poor" },
    conditions: {
      clearSky: "Clear sky",
      denseDrizzle: "Dense drizzle",
      denseFreezingDrizzle: "Dense freezing drizzle",
      fog: "Fog",
      heavyFreezingRain: "Heavy freezing rain",
      heavyRain: "Heavy rain",
      heavySnowShowers: "Heavy snow showers",
      heavySnowfall: "Heavy snowfall",
      lightDrizzle: "Light drizzle",
      lightFreezingDrizzle: "Light freezing drizzle",
      lightFreezingRain: "Light freezing rain",
      mainlyClear: "Mainly clear",
      moderateDrizzle: "Moderate drizzle",
      moderateRain: "Moderate rain",
      moderateRainShowers: "Moderate rain showers",
      moderateSnowfall: "Moderate snowfall",
      overcast: "Overcast",
      partlyCloudy: "Partly cloudy",
      rimeFog: "Rime fog",
      slightRain: "Slight rain",
      slightRainShowers: "Slight rain showers",
      slightSnowShowers: "Slight snow showers",
      slightSnowfall: "Slight snowfall",
      snowGrains: "Snow grains",
      thunderstorm: "Thunderstorm",
      thunderstormWithHeavyHail: "Thunderstorm with heavy hail",
      thunderstormWithSlightHail: "Thunderstorm with slight hail",
      unknown: "Unknown conditions",
      violentRainShowers: "Violent rain showers",
    },
    emptyDescription: "No current weather observation is available right now.",
    emptyTitle: "No weather data",
    errorDescription: "Current conditions are temporarily unavailable. Please try again shortly.",
    errorTitle: "Weather unavailable",
    feelsLike: "Feels like",
    humidity: "Humidity",
    lastUpdated: "Last updated",
    loading: "Loading weather data",
    location: "Podgorica",
    source: "Source",
    status: "Current",
    title: "Weather",
    wind: "Wind",
  },
  me: {
    airQuality: "Kvalitet vazduha",
    airQualityCategories: { good: "Dobar", moderate: "Umjeren", unhealthy: "Loš" },
    conditions: {
      clearSky: "Vedro",
      denseDrizzle: "Jaka rosulja",
      denseFreezingDrizzle: "Jaka ledena rosulja",
      fog: "Magla",
      heavyFreezingRain: "Jaka ledena kiša",
      heavyRain: "Jaka kiša",
      heavySnowShowers: "Jaki snježni pljuskovi",
      heavySnowfall: "Jak snijeg",
      lightDrizzle: "Slaba rosulja",
      lightFreezingDrizzle: "Slaba ledena rosulja",
      lightFreezingRain: "Slaba ledena kiša",
      mainlyClear: "Pretežno vedro",
      moderateDrizzle: "Umjerena rosulja",
      moderateRain: "Umjerena kiša",
      moderateRainShowers: "Umjereni pljuskovi",
      moderateSnowfall: "Umjeren snijeg",
      overcast: "Oblačno",
      partlyCloudy: "Djelimično oblačno",
      rimeFog: "Magla sa injem",
      slightRain: "Slaba kiša",
      slightRainShowers: "Slabi pljuskovi",
      slightSnowShowers: "Slabi snježni pljuskovi",
      slightSnowfall: "Slab snijeg",
      snowGrains: "Snježna zrnca",
      thunderstorm: "Grmljavina",
      thunderstormWithHeavyHail: "Grmljavina s jakim gradom",
      thunderstormWithSlightHail: "Grmljavina sa slabim gradom",
      unknown: "Nepoznati uslovi",
      violentRainShowers: "Jaki pljuskovi",
    },
    emptyDescription: "Trenutno nema dostupnog meteorološkog mjerenja.",
    emptyTitle: "Nema podataka o vremenu",
    errorDescription:
      "Trenutni podaci o vremenu privremeno nijesu dostupni. Pokušajte ponovo uskoro.",
    errorTitle: "Vrijeme nije dostupno",
    feelsLike: "Osjećaj kao",
    humidity: "Vlažnost",
    lastUpdated: "Posljednje ažuriranje",
    loading: "Učitavanje podataka o vremenu",
    location: "Podgorica",
    source: "Izvor",
    status: "Trenutno",
    title: "Vrijeme",
    wind: "Vjetar",
  },
};

function getWeatherTranslations(locale: Locale) {
  return weatherTranslations[locale];
}

export { getWeatherTranslations, type WeatherTranslations };
