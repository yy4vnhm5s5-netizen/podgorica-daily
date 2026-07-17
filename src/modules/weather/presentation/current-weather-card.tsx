import { getCurrentWeather } from "@/modules/weather/application/get-current-weather";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { StatusBadge } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

function WeatherCardFrame({ children }: Readonly<PropsWithChildren>) {
  return <Card className="min-h-44">{children}</Card>;
}

function CurrentWeatherCardLoading() {
  return (
    <WeatherCardFrame>
      <CardHeader>
        <h2 className="text-base font-semibold">Weather</h2>
      </CardHeader>
      <CardContent>
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
        <CardHeader>
          <h2 className="text-base font-semibold">Weather</h2>
        </CardHeader>
        <CardContent>
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
        <CardHeader>
          <h2 className="text-base font-semibold">Weather</h2>
        </CardHeader>
        <CardContent>
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
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <h2 className="text-base font-semibold">Weather</h2>
          <p className="mt-1 text-sm text-muted-foreground">Podgorica</p>
        </div>
        <StatusBadge tone="info">Current</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {temperature.toFixed(1)}°C
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{condition}</p>
          </div>
          {apparentTemperature === null ? null : (
            <p className="text-sm text-muted-foreground">
              Feels like {apparentTemperature.toFixed(1)}°C
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm sm:gap-6">
          <div>
            <dt className="text-muted-foreground">Wind</dt>
            <dd className="mt-1 font-medium">{windSpeed.toFixed(1)} km/h</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Humidity</dt>
            <dd className="mt-1 font-medium">{humidity.toFixed(0)}%</dd>
          </div>
        </dl>
        <div className="space-y-2 text-xs text-muted-foreground">
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
      </CardContent>
    </WeatherCardFrame>
  );
}

export { CurrentWeatherCard, CurrentWeatherCardLoading };
import type { PropsWithChildren } from "react";
