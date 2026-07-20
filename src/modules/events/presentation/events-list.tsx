import type { CityEvent } from "../domain/event.ts";
import { EventCard } from "./event-card";
import { EventsFilterSheet } from "./events-filter-sheet";
import { getEventPresentationCategory } from "./event-presentation-category";
import { getEventsTranslations } from "./events-translations";
import { groupEventsByDay, type EventsUiFilters } from "./events-ui-model";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/shared/components/ui/button";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

interface EventsListProps {
  allEvents: readonly CityEvent[];
  events: readonly CityEvent[];
  filters: EventsUiFilters;
  locale: Locale;
  timezone: string;
}

function EventsList({ allEvents, events, filters, locale, timezone }: EventsListProps) {
  const translations = getEventsTranslations(locale);
  const { eventsCount, ...filterTranslations } = translations;
  const groups = groupEventsByDay(events, timezone);
  const categories = [
    ...new Set(allEvents.map((event) => getEventPresentationCategory(event.category))),
  ].sort();
  const sources = [
    ...new Map(allEvents.map((event) => [event.sourceId, event.sourceName])).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, getLocaleTag(locale)));

  return (
    <section aria-labelledby="events-list-title" className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" id="events-list-title">
          {eventsCount(events.length)}
        </p>
        <EventsFilterSheet
          categories={categories}
          filters={filters}
          locale={locale}
          sources={sources}
          translations={filterTranslations}
        />
      </div>
      <QuickFilters filters={filters} locale={locale} />
      {groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section
              aria-labelledby={`events-day-${group.date}`}
              className="space-y-3"
              key={group.date}
            >
              <h2
                className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                id={`events-day-${group.date}`}
              >
                {formatDayHeading(group.date, locale)}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {group.events.map((event) => (
                  <EventCard event={event} key={event.id} locale={locale} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          description={
            allEvents.length > 0
              ? translations.noResultsDescription
              : translations.noEventsDescription
          }
          title={allEvents.length > 0 ? translations.noResults : translations.noEvents}
        />
      )}
    </section>
  );
}

function QuickFilters({ filters, locale }: { filters: EventsUiFilters; locale: Locale }) {
  const translations = getEventsTranslations(locale);
  const presets = ["today", "tomorrow", "weekend", "upcoming"] as const;

  return (
    <nav aria-label={translations.filters} className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex min-w-max gap-2">
        {presets.map((preset) => {
          const isCurrent = filters.datePreset === preset;
          const href = createEventsHref(locale, { ...filters, datePreset: preset });

          return (
            <li key={preset}>
              <Button asChild size="sm" variant={isCurrent ? "default" : "outline"}>
                <a aria-current={isCurrent ? "page" : undefined} href={href}>
                  {getQuickFilterLabel(translations, preset)}
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function getQuickFilterLabel(
  translations: ReturnType<typeof getEventsTranslations>,
  preset: "today" | "tomorrow" | "weekend" | "upcoming",
) {
  if (preset === "weekend") return translations.quickFilters.thisWeekend;
  if (preset === "upcoming") return translations.quickFilters.upcoming;
  return translations.quickFilters[preset];
}

function createEventsHref(locale: Locale, filters: EventsUiFilters) {
  const params = new URLSearchParams();
  if (filters.datePreset !== "upcoming") params.set("period", filters.datePreset);
  if (filters.query) params.set("query", filters.query);
  if (filters.sourceId) params.set("source", filters.sourceId);
  if (filters.category) params.set("category", filters.category);
  if (filters.sort !== "soonest") params.set("sort", filters.sort);
  const query = params.toString();

  return `/${locale}/events${query ? `?${query}` : ""}`;
}

function formatDayHeading(date: string, locale: Locale) {
  return formatDateTime(new Date(`${date}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "full", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
}

export { EventsList, type EventsListProps };
