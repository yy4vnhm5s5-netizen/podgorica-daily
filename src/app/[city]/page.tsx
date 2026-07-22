import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CityDashboard } from "@/app/city-dashboard";
import { getCityLandingMetadata, resolveActiveCityRoute } from "@/app/city-routing";
import { getActiveCities } from "@/shared/config/cities";

interface CityPageProps {
  params: Promise<{ city: string }>;
}

export const revalidate = 0;

function generateStaticParams() {
  return getActiveCities().map((city) => ({ city: city.slug }));
}

async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityRoute(slug);
  if (!context) return {};
  return getCityLandingMetadata(context);
}

async function CityPage({ params }: CityPageProps) {
  const { city: slug } = await params;
  const context = resolveActiveCityRoute(slug);
  if (!context) notFound();

  return <CityDashboard context={context} />;
}

export { generateMetadata, generateStaticParams };
export default CityPage;
