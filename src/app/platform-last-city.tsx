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
      className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"
      aria-label="Nastavite gdje ste stali"
    >
      <p className="text-sm font-medium text-muted-foreground">Nastavite gdje ste stali</p>
      <Link
        className="mt-1 inline-flex rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={card.href}
      >
        {card.city.name}
      </Link>
    </aside>
  );
}

export { LastCityContinuation, LastCityTracker };
