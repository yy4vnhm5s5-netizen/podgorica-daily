"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";

import { CityCard, CityIdentityIcon } from "@/app/platform-city-panel";
import type { PlatformCityCardData } from "@/app/platform-homepage-data";
import { getStoredActiveCityId, lastCityStorageKey } from "@/app/platform-last-city-state";
import { getRovingTabIndex } from "@/shared/lib/roving-tab-index";
import { cn } from "@/shared/lib/utils";

const platformCityPanelId = "platform-city-panel";

function PlatformCitySelector({ cards }: { cards: readonly PlatformCityCardData[] }) {
  const cityIds = cards.map((card) => card.city.id);
  const defaultCityId = cityIds.includes("podgorica") ? "podgorica" : cityIds[0];
  const [selectedCityId, setSelectedCityId] = useState<string | undefined>(defaultCityId);

  useEffect(() => {
    const stored = getStoredActiveCityId(window.localStorage.getItem(lastCityStorageKey), cityIds);
    if (stored) setSelectedCityId(stored);
    // Only re-derive when the set of active cities itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityIds.join(",")]);

  const activeCard = cards.find((card) => card.city.id === selectedCityId) ?? cards[0];
  if (!activeCard) return null;

  function selectCity(cityId: string) {
    setSelectedCityId(cityId);
    document.getElementById(`platform-city-tab-${cityId}`)?.focus();
  }

  function handleTabClick(event: MouseEvent<HTMLAnchorElement>, cityId: string) {
    // Normal clicks retain the existing in-place tab interaction. The city destinations still
    // render as links on the server, and modifier clicks preserve standard link behaviour.
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    selectCity(cityId);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLAnchorElement>, cityId: string) {
    const index = cityIds.indexOf(cityId);
    const nextId = cityIds[(index + 1) % cityIds.length];
    const previousId = cityIds[(index - 1 + cityIds.length) % cityIds.length];

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectCity(nextId);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectCity(previousId);
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectCity(cityIds[0]);
    }
    if (event.key === "End") {
      event.preventDefault();
      selectCity(cityIds[cityIds.length - 1]);
    }
  }

  return (
    <div className="space-y-4">
      <nav aria-label="Izaberite grad" className="px-1 sm:-mx-1 sm:overflow-x-auto sm:px-1 sm:pb-1">
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/50 p-1 sm:min-w-max sm:flex-nowrap"
          role="tablist"
        >
          {cards.map((card) => {
            const isSelected = card.city.id === selectedCityId;

            return (
              <Link
                aria-controls={platformCityPanelId}
                aria-selected={isSelected}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-3",
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-slate-700 hover:text-foreground",
                )}
                id={`platform-city-tab-${card.city.id}`}
                key={card.city.id}
                href={card.href}
                onClick={(event) => handleTabClick(event, card.city.id)}
                onKeyDown={(event) => handleTabKeyDown(event, card.city.id)}
                role="tab"
                tabIndex={getRovingTabIndex(isSelected)}
              >
                <CityIdentityIcon cityId={card.city.id} size="sm" />
                {card.city.name}
              </Link>
            );
          })}
        </div>
      </nav>
      <div
        aria-labelledby={`platform-city-tab-${activeCard.city.id}`}
        id={platformCityPanelId}
        role="tabpanel"
        tabIndex={-1}
      >
        <CityCard card={activeCard} />
      </div>
    </div>
  );
}

export { PlatformCitySelector };
