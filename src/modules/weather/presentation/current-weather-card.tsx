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
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { StatusBadge } from "@/shared/components/status-badge";
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
    <Card className="min-h-44 overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-background to-background transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-950">
      {children}
    </Card>
  );
}

interface CurrentWeatherCardProps {
  locale: Locale;
}

function CurrentWeatherCardLoading({ locale }: CurrentWeatherCardProps) {
  const translations = getWeatherTranslations(locale);

  return (
    <WeatherCardFrame>
      <CardHeader className="flex-row items-center gap-3 space-y-0 bg-emerald-100/40 dark:bg-emerald-950/20">
        <CloudSun
          aria-hidden="true"
          className="size-[1.125rem] text-emerald-700 dark:text-emerald-300"
          strokeWidth={1.8}
        />
        <h2 className="text-base font-semibold">{translations.title}</h2>
      </CardHeader>
      <CardContent className="pt-6">
        <LoadingSkeleton label={translations.loading} lines={4} />
      </CardContent>
    </WeatherCardFrame>
  );
}

async function CurrentWeatherCard({ locale }: CurrentWeatherCardProps) {
  const result = await getCurrentWeather(getDefaultCityContext(locale));
  const translations = getWeatherTranslations(locale);

  if (result.status === "error") {
    return (
      <WeatherCardFrame>
        <CardHeader className="flex-row items-center gap-3 space-y-0 bg-emerald-100/40 dark:bg-emerald-950/20">
          <CloudSun
            aria-hidden="true"
            className="size-[1.125rem] text-emerald-700 dark:text-emerald-300"
            strokeWidth={1.8}
          />
          <h2 className="text-base font-semibold">{translations.title}</h2>
        </CardHeader>
        <CardContent className="pt-6">
          <ErrorState description={translations.errorDescription} title={translations.errorTitle} />
        </CardContent>
      </WeatherCardFrame>
    );
  }

  if (result.status === "empty") {
    return (
      <WeatherCardFrame>
        <CardHeader className="flex-row items-center gap-3 space-y-0 bg-emerald-100/40 dark:bg-emerald-950/20">
          <CloudSun
            aria-hidden="true"
            className="size-[1.125rem] text-emerald-700 dark:text-emerald-300"
            strokeWidth={1.8}
          />
          <h2 className="text-base font-semibold">{translations.title}</h2>
        </CardHeader>
        <CardContent className="pt-6">
          <EmptyState description={translations.emptyDescription} title={translations.emptyTitle} />
        </CardContent>
      </WeatherCardFrame>
    );
  }

  const { apparentTemperature, condition, humidity, temperature, updatedAt, windSpeed } =
    result.data;

  return (
    <WeatherCardFrame>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 bg-emerald-100/40 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <CloudSun
            aria-hidden="true"
            className="mt-0.5 size-[1.125rem] shrink-0 text-emerald-700 dark:text-emerald-300"
            strokeWidth={1.8}
          />
          <div>
            <h2 className="text-base font-semibold">{translations.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{translations.location}</p>
          </div>
        </div>
        <StatusBadge tone="info">{translations.status}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-5xl font-semibold tracking-tighter sm:text-6xl">
              {temperature.toFixed(1)}°C
            </p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {translations.conditions[condition]}
            </p>
          </div>
          <WeatherGlyph condition={condition} />
        </div>
        {apparentTemperature === null ? null : (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {translations.feelsLike}{" "}
            <span className="font-medium text-foreground">{apparentTemperature.toFixed(1)}°C</span>
          </p>
        )}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
          <div className="bg-background p-3 sm:p-4">
            <dt className="text-muted-foreground">{translations.wind}</dt>
            <dd className="mt-1 text-base font-semibold">{windSpeed.toFixed(1)} km/h</dd>
          </div>
          <div className="bg-background p-3 sm:p-4">
            <dt className="text-muted-foreground">{translations.humidity}</dt>
            <dd className="mt-1 text-base font-semibold">{humidity.toFixed(0)}%</dd>
          </div>
        </dl>
        <div className="border-t pt-4 text-xs text-muted-foreground">
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

interface WeatherGlyphProps {
  condition: WeatherConditionKey;
}

function WeatherGlyph({ condition }: WeatherGlyphProps) {
  const Icon = weatherIcons[getWeatherConditionIcon(condition)];

  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 sm:size-16">
      <Icon aria-hidden="true" className="size-7 sm:size-8" />
    </div>
  );
}
