interface CurrentWeather {
  apparentTemperature: number | null;
  condition: string;
  humidity: number;
  temperature: number;
  updatedAt: Date;
  windSpeed: number;
}

type WeatherConditionIcon =
  | "clear"
  | "drizzle"
  | "fog"
  | "overcast"
  | "partly-cloudy"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "unknown";

interface WeatherConditionDefinition {
  icon: WeatherConditionIcon;
  label: string;
}

const weatherConditions: Record<number, WeatherConditionDefinition> = {
  0: { icon: "clear", label: "Clear sky" },
  1: { icon: "clear", label: "Mainly clear" },
  2: { icon: "partly-cloudy", label: "Partly cloudy" },
  3: { icon: "overcast", label: "Overcast" },
  45: { icon: "fog", label: "Fog" },
  48: { icon: "fog", label: "Rime fog" },
  51: { icon: "drizzle", label: "Light drizzle" },
  53: { icon: "drizzle", label: "Moderate drizzle" },
  55: { icon: "drizzle", label: "Dense drizzle" },
  56: { icon: "drizzle", label: "Light freezing drizzle" },
  57: { icon: "drizzle", label: "Dense freezing drizzle" },
  61: { icon: "rain", label: "Slight rain" },
  63: { icon: "rain", label: "Moderate rain" },
  65: { icon: "rain", label: "Heavy rain" },
  66: { icon: "rain", label: "Light freezing rain" },
  67: { icon: "rain", label: "Heavy freezing rain" },
  71: { icon: "snow", label: "Slight snowfall" },
  73: { icon: "snow", label: "Moderate snowfall" },
  75: { icon: "snow", label: "Heavy snowfall" },
  77: { icon: "snow", label: "Snow grains" },
  80: { icon: "rain", label: "Slight rain showers" },
  81: { icon: "rain", label: "Moderate rain showers" },
  82: { icon: "rain", label: "Violent rain showers" },
  85: { icon: "snow", label: "Slight snow showers" },
  86: { icon: "snow", label: "Heavy snow showers" },
  95: { icon: "thunderstorm", label: "Thunderstorm" },
  96: { icon: "thunderstorm", label: "Thunderstorm with slight hail" },
  99: { icon: "thunderstorm", label: "Thunderstorm with heavy hail" },
};

function getWeatherCondition(weatherCode: number) {
  return weatherConditions[weatherCode]?.label ?? "Unknown conditions";
}

function getWeatherConditionIcon(condition: string): WeatherConditionIcon {
  return (
    Object.values(weatherConditions).find(({ label }) => label === condition)?.icon ?? "unknown"
  );
}

export {
  getWeatherCondition,
  getWeatherConditionIcon,
  type CurrentWeather,
  type WeatherConditionIcon,
};
