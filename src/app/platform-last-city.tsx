"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { PlatformCityCardData } from "@/app/platform-homepage-data";
import { getStoredActiveCityId, lastCityStorageKey } from "@/app/platform-last-city-state";

function LastCityTracker({
  activeCityIds,
  cityId,
}: {
  activeCityIds: readonly string[];
  cityId: string;
}) {
  useEffect(() => {
    if (!activeCityIds.includes(cityId)) return;
    window.localStorage.setItem(lastCityStorageKey, cityId);
  }, [activeCityIds, cityId]);

  return null;
}

function LastCityContinuation({ cards }: { cards: readonly PlatformCityCardData[] }) {
  const [cityId, setCityId] = useState<string>();
  const activeCityIds = cards.map((card) => card.city.id);

  useEffect(() => {
    setCityId(
      getStoredActiveCityId(window.localStorage.getItem(lastCityStorageKey), activeCityIds),
    );
  }, [activeCityIds]);

  if (cards.length < 2 || !cityId) return null;
  const card = cards.find((candidate) => candidate.city.id === cityId);
  if (!card) return null;

  return (
    <aside
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5"
      aria-label="Nastavite gdje ste stali"
    >
      <p className="text-sm font-medium text-muted-foreground">Nastavite gdje ste stali</p>
      <Link
        className="focus-visible:ring-ring inline-flex min-h-8 shrink-0 items-center rounded-md border border-primary/20 bg-background/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:border-primary/35 hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        href={card.href}
      >
        {card.city.name}
      </Link>
    </aside>
  );
}

export { LastCityContinuation, LastCityTracker };
