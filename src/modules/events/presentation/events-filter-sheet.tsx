"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRef, type ReactNode } from "react";

import type { EventsTranslations } from "./events-translations";
import type { EventPresentationCategory } from "./event-presentation-category";
import type { EventsUiFilters } from "./events-ui-model";
import { Button } from "@/shared/components/ui/button";
import type { Locale } from "@/shared/config/locale";

interface EventsFilterSheetProps {
  categories: readonly EventPresentationCategory[];
  filters: EventsUiFilters;
  locale: Locale;
  sources: readonly { id: string; name: string }[];
  translations: EventsFilterTranslations;
}

type EventsFilterTranslations = Omit<EventsTranslations, "eventsCount">;

function EventsFilterSheet({
  categories,
  filters,
  locale,
  sources,
  translations,
}: EventsFilterSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="gap-2"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
        variant="outline"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {translations.filters}
      </Button>
      <dialog
        aria-labelledby="events-filter-title"
        className="m-0 ml-auto h-full w-full max-w-md border-0 bg-background p-0 text-foreground shadow-2xl backdrop:bg-foreground/30"
        ref={dialogRef}
      >
        <form action={`/${locale}/events`} className="flex h-full flex-col" method="get">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="text-lg font-semibold" id="events-filter-title">
              {translations.filters}
            </h2>
            <Button
              aria-label={translations.closeFilters}
              onClick={() => dialogRef.current?.close()}
              size="sm"
              type="button"
              variant="outline"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <SearchField
              label={translations.search}
              placeholder={translations.searchPlaceholder}
              value={filters.query}
            />
            <FilterField label={translations.provider} name="source" value={filters.sourceId}>
              <option value="">{translations.all}</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </FilterField>
            <FilterField label={translations.category} name="category" value={filters.category}>
              <option value="">{translations.all}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {translations.presentationCategories[category]}
                </option>
              ))}
            </FilterField>
            <FilterField label={translations.date} name="period" value={filters.datePreset}>
              <option value="upcoming">{translations.quickFilters.upcoming}</option>
              <option value="today">{translations.quickFilters.today}</option>
              <option value="tomorrow">{translations.quickFilters.tomorrow}</option>
              <option value="weekend">{translations.quickFilters.thisWeekend}</option>
            </FilterField>
            <FilterField label={translations.sort} name="sort" value={filters.sort}>
              {Object.entries(translations.sortOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </FilterField>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t p-5">
            <a
              className="inline-flex h-10 items-center justify-center rounded-md border border-border text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={`/${locale}/events`}
            >
              {translations.resetFilters}
            </a>
            <Button type="submit">{translations.applyFilters}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function SearchField({
  label,
  placeholder,
  value,
}: {
  label: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium" htmlFor="events-filter-query">
      {label}
      <input
        className="border-input h-11 rounded-md border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
        defaultValue={value ?? ""}
        id="events-filter-query"
        name="query"
        placeholder={placeholder}
        type="search"
      />
    </label>
  );
}

function FilterField({
  children,
  label,
  name,
  value,
}: {
  children: ReactNode;
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium" htmlFor={`events-filter-${name}`}>
      {label}
      <select
        className="border-input h-11 rounded-md border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        defaultValue={value ?? ""}
        id={`events-filter-${name}`}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

export { EventsFilterSheet, type EventsFilterSheetProps, type EventsFilterTranslations };
