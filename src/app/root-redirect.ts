import { getMainCityLandingContext } from "@/app/city-routing";
import { getCityPath } from "@/shared/config/public-routes";

function getCanonicalMainCityPath() {
  return getCityPath(getMainCityLandingContext().city);
}

export { getCanonicalMainCityPath };
