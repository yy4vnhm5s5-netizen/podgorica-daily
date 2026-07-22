import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { getTranslations } from "@/shared/lib/translations";

function EventsLoading() {
  const translations = getTranslations("me");

  return (
    <DashboardLayout translations={translations}>
      <section aria-busy="true" aria-label="Učitavanje događaja" className="space-y-6">
        <LoadingSkeleton className="h-20" label="Učitavanje događaja" lines={1} />
        <LoadingSkeleton className="h-36" label="Učitavanje događaja" lines={3} />
        <LoadingSkeleton className="h-36" label="Učitavanje događaja" lines={3} />
      </section>
    </DashboardLayout>
  );
}

export default EventsLoading;
