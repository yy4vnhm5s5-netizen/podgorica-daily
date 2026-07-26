import { supportsCityCapability } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

type CityAlertServiceId = "power" | "water";

const cityAlertServiceIds: readonly CityAlertServiceId[] = ["power", "water"];

function getCityAlertServiceIds(city: City): readonly CityAlertServiceId[] {
  return cityAlertServiceIds.filter((serviceId) =>
    supportsCityCapability(city, serviceId === "power" ? "electricity" : "water"),
  );
}

export { getCityAlertServiceIds, type CityAlertServiceId };
