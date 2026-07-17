import { Search } from "lucide-react";

import type { CityEvent } from "../domain/event.ts";
import { EventCard } from "./event-card";
import { EventsFilterSheet } from "./events-filter-sheet";
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
  const groups = groupEventsByDay(events, timezone);
  const categories = [...new Set(allEvents.map((event) => event.category))].sort();
  const sources = [
    ...new Map(allEvents.map((event) => [event.sourceId, event.sourceName])).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, getLocaleTag(locale)));

  return (
    <section aria-labelledby="events-list-title" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" id="events-list-title">
          {translations.eventsCount(events.length)}
        </p>
        <div className="flex items-center gap-2">
          <form
            action={`/${locale}/events`}
            className="relative flex-1 sm:w-72"
            method="get"
            role="search"
          >
            <label className="sr-only" htmlFor="events-search">
              {translations.search}
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              className="border-input h-11 w-full rounded-md border bg-background py-2 pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
              defaultValue={filters.query}
              id="events-search"
              name="query"
              placeholder={translations.searchPlaceholder}
              type="search"
            />
            {filters.datePreset !== "all" ? (
              <input name="period" type="hidden" value={filters.datePreset} />
            ) : null}
            {filters.sourceId ? (
              <input name="source" type="hidden" value={filters.sourceId} />
            ) : null}
            {filters.category ? (
              <input name="category" type="hidden" value={filters.category} />
            ) : null}
            {filters.sort !== "soonest" ? (
              <input name="sort" type="hidden" value={filters.sort} />
            ) : null}
          </form>
          <EventsFilterSheet
            categories={categories}
            filters={filters}
            locale={locale}
            sources={sources}
            translations={translations}
          />
        </div>
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
  const presets = ["all", "today", "weekend", "next-seven-days"] as const;

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
  preset: "all" | "today" | "weekend" | "next-seven-days",
) {
  if (preset === "weekend") return translations.quickFilters.thisWeekend;
  if (preset === "next-seven-days") return translations.quickFilters.nextSevenDays;
  return translations.quickFilters[preset];
}

function createEventsHref(locale: Locale, filters: EventsUiFilters) {
  const params = new URLSearchParams();
  if (filters.datePreset !== "all") params.set("period", filters.datePreset);
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
