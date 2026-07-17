import type { CityContext } from "@/shared/types/city";
import type { CityId } from "@/shared/types/city";

interface ProviderMetadata {
  cachePath?: string;
  displayName: string;
  enabled: boolean;
  id: string;
  officialSource: string;
  providerMode?: "disabled" | "live" | "mock";
  refreshIntervalMinutes: number;
  sourceUrl?: string;
  supportedCityIds?: readonly CityId[];
  supportsMultipleCities: boolean;
}

interface CityProvider<T> {
  getCityData(context: CityContext): Promise<T>;
  metadata: ProviderMetadata;
}

export { type CityProvider, type ProviderMetadata };
