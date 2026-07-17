interface CurrentWeather {
  apparentTemperature: number | null;
  condition: WeatherConditionKey;
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

type WeatherConditionKey =
  | "clearSky"
  | "denseDrizzle"
  | "denseFreezingDrizzle"
  | "fog"
  | "heavyFreezingRain"
  | "heavyRain"
  | "heavySnowShowers"
  | "heavySnowfall"
  | "lightDrizzle"
  | "lightFreezingDrizzle"
  | "lightFreezingRain"
  | "mainlyClear"
  | "moderateDrizzle"
  | "moderateRain"
  | "moderateRainShowers"
  | "moderateSnowfall"
  | "overcast"
  | "partlyCloudy"
  | "rimeFog"
  | "slightRain"
  | "slightRainShowers"
  | "slightSnowShowers"
  | "slightSnowfall"
  | "snowGrains"
  | "thunderstorm"
  | "thunderstormWithHeavyHail"
  | "thunderstormWithSlightHail"
  | "unknown"
  | "violentRainShowers";

interface WeatherConditionDefinition {
  icon: WeatherConditionIcon;
  key: WeatherConditionKey;
}

const weatherConditions: Record<number, WeatherConditionDefinition> = {
  0: { icon: "clear", key: "clearSky" },
  1: { icon: "clear", key: "mainlyClear" },
  2: { icon: "partly-cloudy", key: "partlyCloudy" },
  3: { icon: "overcast", key: "overcast" },
  45: { icon: "fog", key: "fog" },
  48: { icon: "fog", key: "rimeFog" },
  51: { icon: "drizzle", key: "lightDrizzle" },
  53: { icon: "drizzle", key: "moderateDrizzle" },
  55: { icon: "drizzle", key: "denseDrizzle" },
  56: { icon: "drizzle", key: "lightFreezingDrizzle" },
  57: { icon: "drizzle", key: "denseFreezingDrizzle" },
  61: { icon: "rain", key: "slightRain" },
  63: { icon: "rain", key: "moderateRain" },
  65: { icon: "rain", key: "heavyRain" },
  66: { icon: "rain", key: "lightFreezingRain" },
  67: { icon: "rain", key: "heavyFreezingRain" },
  71: { icon: "snow", key: "slightSnowfall" },
  73: { icon: "snow", key: "moderateSnowfall" },
  75: { icon: "snow", key: "heavySnowfall" },
  77: { icon: "snow", key: "snowGrains" },
  80: { icon: "rain", key: "slightRainShowers" },
  81: { icon: "rain", key: "moderateRainShowers" },
  82: { icon: "rain", key: "violentRainShowers" },
  85: { icon: "snow", key: "slightSnowShowers" },
  86: { icon: "snow", key: "heavySnowShowers" },
  95: { icon: "thunderstorm", key: "thunderstorm" },
  96: { icon: "thunderstorm", key: "thunderstormWithSlightHail" },
  99: { icon: "thunderstorm", key: "thunderstormWithHeavyHail" },
};

function getWeatherCondition(weatherCode: number): WeatherConditionKey {
  return weatherConditions[weatherCode]?.key ?? "unknown";
}

function getWeatherConditionIcon(condition: WeatherConditionKey): WeatherConditionIcon {
  return Object.values(weatherConditions).find(({ key }) => key === condition)?.icon ?? "unknown";
}

export {
  getWeatherCondition,
  getWeatherConditionIcon,
  type CurrentWeather,
  type WeatherConditionIcon,
  type WeatherConditionKey,
};
