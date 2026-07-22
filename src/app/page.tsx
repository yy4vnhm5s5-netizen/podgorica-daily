import type { Metadata } from "next";

import { CityDashboard } from "@/app/city-dashboard";
import { getCityLandingMetadata, getMainCityLandingContext } from "@/app/city-routing";

export const revalidate = 0;

function generateMetadata(): Metadata {
  return getCityLandingMetadata(getMainCityLandingContext());
}

function HomePage() {
  return <CityDashboard context={getMainCityLandingContext()} />;
}

export { generateMetadata };
export default HomePage;
