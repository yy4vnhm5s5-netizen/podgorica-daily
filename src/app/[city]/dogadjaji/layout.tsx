import { notFound } from "next/navigation";
import type { PropsWithChildren } from "react";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";

interface EventsLayoutProps extends PropsWithChildren {
  params: Promise<{ city: string }>;
}

// This segment owns the app's only loading.tsx, which is exactly why the guard belongs here and
// not in page.tsx. A loading file creates a Suspense boundary: Next streams the skeleton at once,
// committing HTTP 200 before the page body runs. A notFound() in the page therefore rendered the
// not-found UI into an already-200 response — a soft 404 on the four unsupported events cities.
// Every other unsupported feature route returns a real 404 only because it has no such boundary.
//
// A layout resolves above that boundary, so an unsupported city is rejected before any byte is
// flushed and the response is a genuine 404. Availability comes from the same shared helper the
// page and the sitemap use — no second events city list exists anywhere.
async function EventsLayout({ children, params }: EventsLayoutProps) {
  const { city: slug } = await params;
  if (!resolveActiveCityFeatureRoute(slug, "events")) notFound();

  return children;
}

export default EventsLayout;
