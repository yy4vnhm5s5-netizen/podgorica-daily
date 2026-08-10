import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  isCityPublicFeatureRouteAvailable,
  resolveActiveCityFeatureRoute,
} from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { resolvePublicGoingOutDetail } from "@/modules/going-out/application/going-out-public-detail";
import { GoingOutDetail } from "@/modules/going-out/presentation/going-out-detail";
import {
  createGoingOutDetailMetadataDescription,
  createGoingOutDetailMetadataTitle,
} from "@/modules/going-out/presentation/going-out-detail-metadata";
import {
  createGoingOutDetailBreadcrumbStructuredData,
  createGoingOutDetailStructuredData,
  serializeGoingOutStructuredData,
} from "@/modules/going-out/presentation/going-out-detail-structured-data";
import { formatGoingOutSchedule } from "@/modules/going-out/presentation/going-out-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getCityName } from "@/shared/config/cities";
import { getGoingOutDetailPath } from "@/shared/config/public-routes";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface GoingOutDetailRouteProps {
  params: Promise<{ city: string; eventKey: string }>;
}

// Both metadata and the page resolve the same local snapshot. Request-scoped cache() prevents a
// duplicate file read without widening the cache boundary beyond this route.
const getCachedContext = cache((slug: string) => resolveActiveCityFeatureRoute(slug, "goingOut"));
const getCachedGoingOutEvents = cache(getGoingOutEvents);

async function getPublicDetail(slug: string, eventKey: string) {
  const context = getCachedContext(slug);
  if (!context || !isCityPublicFeatureRouteAvailable(context.city, "goingOut")) {
    return undefined;
  }

  const result = await getCachedGoingOutEvents(context);
  const event = resolvePublicGoingOutDetail({
    context,
    eventKey,
    events: result.events,
    state: result.state,
  });

  return event ? { context, event, state: result.state } : undefined;
}

async function generateMetadata({ params }: GoingOutDetailRouteProps): Promise<Metadata> {
  const { city: slug, eventKey } = await params;
  const detail = await getPublicDetail(slug, eventKey);
  if (!detail) return {};

  const schedule = formatGoingOutSchedule(detail.event, "me");
  return createPublicRouteMetadata({
    canonical: getGoingOutDetailPath(detail.context.city, "montegigs", detail.event.sourceEventId),
    description: createGoingOutDetailMetadataDescription({
      cityLocative: getCityName(detail.context.city, "locative"),
      event: detail.event,
      schedule,
    }),
    ...(detail.event.imageUrl ? { imageUrl: detail.event.imageUrl } : {}),
    title: createGoingOutDetailMetadataTitle({ city: detail.context.city, event: detail.event }),
  });
}

async function GoingOutDetailRoute({ params }: GoingOutDetailRouteProps) {
  const { city: slug, eventKey } = await params;
  const detail = await getPublicDetail(slug, eventKey);
  if (!detail) notFound();

  const structuredData = createGoingOutDetailStructuredData(detail.event, detail.context.city);
  const breadcrumbStructuredData = createGoingOutDetailBreadcrumbStructuredData(
    detail.context.city,
    detail.event,
  );

  return (
    <DashboardLayout city={detail.context.city} translations={getTranslations("me")}>
      {structuredData ? (
        <script
          dangerouslySetInnerHTML={{ __html: serializeGoingOutStructuredData(structuredData) }}
          type="application/ld+json"
        />
      ) : null}
      <script
        dangerouslySetInnerHTML={{
          __html: serializeGoingOutStructuredData(breadcrumbStructuredData),
        }}
        type="application/ld+json"
      />
      <GoingOutDetail
        city={detail.context.city}
        event={detail.event}
        locale="me"
        stale={detail.state === "stale"}
      />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default GoingOutDetailRoute;
