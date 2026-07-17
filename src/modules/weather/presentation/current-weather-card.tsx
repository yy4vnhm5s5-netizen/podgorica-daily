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

import { getCurrentWeather } from "@/modules/weather/application/get-current-weather";
import {
  getWeatherConditionIcon,
  type WeatherConditionIcon,
} from "@/modules/weather/domain/current-weather";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { StatusBadge } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

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
  return <Card className="min-h-44 overflow-hidden">{children}</Card>;
}

function CurrentWeatherCardLoading() {
  return (
    <WeatherCardFrame>
      <CardHeader className="bg-muted/30">
        <h2 className="text-base font-semibold">Weather</h2>
      </CardHeader>
      <CardContent className="pt-6">
        <LoadingSkeleton lines={4} />
      </CardContent>
    </WeatherCardFrame>
  );
}

async function CurrentWeatherCard() {
  const result = await getCurrentWeather();

  if (result.status === "error") {
    return (
      <WeatherCardFrame>
        <CardHeader className="bg-muted/30">
          <h2 className="text-base font-semibold">Weather</h2>
        </CardHeader>
        <CardContent className="pt-6">
          <ErrorState
            description="Current conditions are temporarily unavailable. Please try again shortly."
            title="Weather unavailable"
          />
        </CardContent>
      </WeatherCardFrame>
    );
  }

  if (result.status === "empty") {
    return (
      <WeatherCardFrame>
        <CardHeader className="bg-muted/30">
          <h2 className="text-base font-semibold">Weather</h2>
        </CardHeader>
        <CardContent className="pt-6">
          <EmptyState
            description="No current weather observation is available right now."
            title="No weather data"
          />
        </CardContent>
      </WeatherCardFrame>
    );
  }

  const { apparentTemperature, condition, humidity, temperature, updatedAt, windSpeed } =
    result.data;

  return (
    <WeatherCardFrame>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 bg-muted/30">
        <div>
          <h2 className="text-base font-semibold">Weather</h2>
          <p className="mt-1 text-sm text-muted-foreground">Podgorica</p>
        </div>
        <StatusBadge tone="info">Current</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-5xl font-semibold tracking-tighter sm:text-6xl">
              {temperature.toFixed(1)}°C
            </p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">{condition}</p>
          </div>
          <WeatherGlyph condition={condition} />
        </div>
        {apparentTemperature === null ? null : (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            Feels like{" "}
            <span className="font-medium text-foreground">{apparentTemperature.toFixed(1)}°C</span>
          </p>
        )}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
          <div className="bg-background p-3 sm:p-4">
            <dt className="text-muted-foreground">Wind</dt>
            <dd className="mt-1 text-base font-semibold">{windSpeed.toFixed(1)} km/h</dd>
          </div>
          <div className="bg-background p-3 sm:p-4">
            <dt className="text-muted-foreground">Humidity</dt>
            <dd className="mt-1 text-base font-semibold">{humidity.toFixed(0)}%</dd>
          </div>
        </dl>
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p>
              Source:{" "}
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href="https://open-meteo.com/"
              >
                Open-Meteo
              </a>
            </p>
            <p>
              Last updated <Timestamp value={updatedAt} />
            </p>
          </div>
        </div>
      </CardContent>
    </WeatherCardFrame>
  );
}

export { CurrentWeatherCard, CurrentWeatherCardLoading };

interface WeatherGlyphProps {
  condition: string;
}

function WeatherGlyph({ condition }: WeatherGlyphProps) {
  const Icon = weatherIcons[getWeatherConditionIcon(condition)];

  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:size-16">
      <Icon aria-hidden="true" className="size-7 sm:size-8" />
    </div>
  );
}
