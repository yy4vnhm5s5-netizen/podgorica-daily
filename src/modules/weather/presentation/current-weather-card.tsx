import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSun,
  Cloudy,
  CloudLightning,
  CloudSnow,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { getDefaultCityContext } from "@/config/city-context";
import { getCurrentWeather } from "@/modules/weather/application/get-current-weather";
import {
  getWeatherConditionIcon,
  type WeatherConditionIcon,
  type WeatherConditionKey,
} from "@/modules/weather/domain/current-weather";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { StatusBadge, type StatusTone } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";
import { getWeatherTranslations } from "@/modules/weather/presentation/weather-translations";

const weatherIcons: Record<WeatherConditionIcon, LucideIcon> = {
  clear: Sun,
  drizzle: CloudDrizzle,
  fog: CloudFog,
  overcast: Cloudy,
  "partly-cloudy": CloudSun,
  rain: CloudRain,
  snow: CloudSnow,
  thunderstorm: CloudLightning,
  unknown: Cloud,
};

function WeatherCardFrame({ children }: Readonly<PropsWithChildren>) {
  return (
    <Card className="overflow-hidden border-sky-200/80 bg-sky-50/80 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      {children}
    </Card>
  );
}

interface CurrentWeatherCardProps {
  airQualityCategory?: "good" | "moderate" | "unhealthy";
  locale: Locale;
}

function CurrentWeatherCardLoading({ locale }: CurrentWeatherCardProps) {
  const translations = getWeatherTranslations(locale);

  return (
    <WeatherCardFrame>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <CloudSun
          aria-hidden="true"
          className="size-[1.125rem] text-sky-700 dark:text-sky-300"
          strokeWidth={1.8}
        />
        <h2 className="text-base font-semibold">{translations.title}</h2>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <LoadingSkeleton label={translations.loading} lines={2} />
      </CardContent>
    </WeatherCardFrame>
  );
}

async function CurrentWeatherCard({ airQualityCategory, locale }: CurrentWeatherCardProps) {
  const result = await getCurrentWeather(getDefaultCityContext(locale));
  const translations = getWeatherTranslations(locale);

  if (result.status === "error") {
    return (
      <WeatherCardFrame>
        <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
          <CloudSun
            aria-hidden="true"
            className="size-[1.125rem] text-sky-700 dark:text-sky-300"
            strokeWidth={1.8}
          />
          <h2 className="text-base font-semibold">{translations.title}</h2>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <WeatherUnavailable description={translations.errorDescription} />
        </CardContent>
      </WeatherCardFrame>
    );
  }

  if (result.status === "empty") {
    return (
      <WeatherCardFrame>
        <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
          <CloudSun
            aria-hidden="true"
            className="size-[1.125rem] text-sky-700 dark:text-sky-300"
            strokeWidth={1.8}
          />
          <h2 className="text-base font-semibold">{translations.title}</h2>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <WeatherUnavailable description={translations.emptyDescription} />
        </CardContent>
      </WeatherCardFrame>
    );
  }

  const { apparentTemperature, condition, temperature, updatedAt, windSpeed } = result.data;

  return (
    <WeatherCardFrame>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CloudSun
            aria-hidden="true"
            className="mt-0.5 size-[1.125rem] shrink-0 text-sky-700 dark:text-sky-300"
            strokeWidth={1.8}
          />
          <div>
            <h2 className="text-base font-semibold">{translations.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{translations.location}</p>
          </div>
        </div>
        <StatusBadge tone="info">{translations.status}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold tracking-tight">
              {translations.conditions[condition]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {translations.feelsLike} {apparentTemperature?.toFixed(1) ?? temperature.toFixed(1)}°C
            </p>
          </div>
          <WeatherGlyph condition={condition} />
        </div>
        {airQualityCategory ? (
          <section className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5">
            <h3 className="text-sm font-medium text-foreground">{translations.airQuality}</h3>
            <StatusBadge tone={airQualityTones[airQualityCategory]}>
              {translations.airQualityCategories[airQualityCategory]}
            </StatusBadge>
          </section>
        ) : null}
        <dl className="rounded-lg border bg-background/70 text-sm">
          <div className="p-3">
            <dt className="text-muted-foreground">{translations.wind}</dt>
            <dd className="mt-1 text-base font-semibold">{windSpeed.toFixed(1)} km/h</dd>
          </div>
        </dl>
        <div className="border-t pt-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p>
              {translations.source}:{" "}
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href="https://open-meteo.com/"
              >
                Open-Meteo
              </a>
            </p>
            <p>
              {translations.lastUpdated}{" "}
              <Timestamp locale={getLocaleTag(locale)} value={updatedAt} />
            </p>
          </div>
        </div>
      </CardContent>
    </WeatherCardFrame>
  );
}

export { CurrentWeatherCard, CurrentWeatherCardLoading };

function WeatherUnavailable({ description }: { description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
      <CloudSun aria-hidden="true" className="size-4 shrink-0 text-sky-700" strokeWidth={1.8} />
      <p>{description}</p>
    </div>
  );
}

const airQualityTones: Record<"good" | "moderate" | "unhealthy", StatusTone> = {
  good: "success",
  moderate: "warning",
  unhealthy: "error",
};

interface WeatherGlyphProps {
  condition: WeatherConditionKey;
}

function WeatherGlyph({ condition }: WeatherGlyphProps) {
  const Icon = weatherIcons[getWeatherConditionIcon(condition)];

  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-sky-100/70 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 sm:size-16">
      <Icon aria-hidden="true" className="size-7 sm:size-8" />
    </div>
  );
}
