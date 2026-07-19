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
import { getWeatherTranslations } from "@/modules/weather/presentation/weather-translations";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";

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
    <Card className="card-fog card-fog--weather border-sky-200/80 bg-sky-50/60 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
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

async function CurrentWeatherCard({ locale }: CurrentWeatherCardProps) {
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

  const { apparentTemperature, condition, humidity, temperature, updatedAt, windSpeed } = result.data;

  return (
    <WeatherCardFrame>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <CloudSun
          aria-hidden="true"
          className="size-[1.125rem] shrink-0 text-sky-700 dark:text-sky-300"
          strokeWidth={1.8}
        />
        <div>
          <h2 className="text-base font-semibold">{translations.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{translations.location}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl">
              {temperature.toFixed(0)}°
            </p>
            <p className="mt-2 text-base font-semibold tracking-tight">
              {translations.conditions[condition]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {translations.feelsLike} {apparentTemperature?.toFixed(1) ?? temperature.toFixed(1)}°C
            </p>
          </div>
          <WeatherGlyph condition={condition} />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-3 text-sm">
          <WeatherMetric label={translations.wind} value={`${windSpeed.toFixed(1)} km/h`} />
          <WeatherMetric label={translations.humidity} value={`${humidity.toFixed(0)}%`} />
        </dl>
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {translations.lastUpdated} <Timestamp locale={getLocaleTag(locale)} value={updatedAt} />
        </p>
      </CardContent>
    </WeatherCardFrame>
  );
}

interface WeatherMetricProps {
  label: string;
  value: string;
}

function WeatherMetric({ label, value }: WeatherMetricProps) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
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

interface WeatherGlyphProps {
  condition: WeatherConditionKey;
}

function WeatherGlyph({ condition }: WeatherGlyphProps) {
  const Icon = weatherIcons[getWeatherConditionIcon(condition)];

  return (
    <Icon
      aria-hidden="true"
      className="size-7 shrink-0 text-sky-700 sm:size-8"
      strokeWidth={1.8}
    />
  );
}
