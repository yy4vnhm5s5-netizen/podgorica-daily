import type { CityContext } from "@/shared/types/city";

interface ProviderMetadata {
  cachePath?: string;
  displayName: string;
  enabled: boolean;
  id: string;
  officialSource: string;
  refreshIntervalMinutes: number;
  supportsMultipleCities: boolean;
}

interface CityProvider<T> {
  getCityData(context: CityContext): Promise<T>;
  metadata: ProviderMetadata;
}

export { type CityProvider, type ProviderMetadata };
