"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

import { CityCard, CityIdentityIcon } from "@/app/platform-city-panel";
import type { PlatformCityCardData } from "@/app/platform-homepage-data";
import { getStoredActiveCityId, lastCityStorageKey } from "@/app/platform-last-city-state";
import { CitySignature } from "@/shared/components/city-signature";
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

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, cityId: string) {
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
    <div className="relative space-y-4">
      {/* City "signature" — a single, very faint landmark for whichever city is currently
          selected in this tab panel (the only place on the homepage where "the selected city"
          is actually known and reactive; the hero above is city-agnostic and stays untouched).
          Same full-viewport-width breakout used elsewhere on this page, so it bleeds toward the
          real page edge rather than being boxed in by this component's own padded column. */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        <CitySignature cityId={activeCard.city.id} className="-right-20 top-0 h-[220px] w-[440px]" />
      </div>
      <nav aria-label="Izaberite grad" className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          className="flex min-w-max gap-1 rounded-xl border border-border/70 bg-muted/50 p-1"
          role="tablist"
        >
          {cards.map((card) => {
            const isSelected = card.city.id === selectedCityId;

            return (
              <button
                aria-controls={platformCityPanelId}
                aria-selected={isSelected}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-slate-700 hover:text-foreground",
                )}
                id={`platform-city-tab-${card.city.id}`}
                key={card.city.id}
                onClick={() => selectCity(card.city.id)}
                onKeyDown={(event) => handleTabKeyDown(event, card.city.id)}
                role="tab"
                tabIndex={getRovingTabIndex(isSelected)}
                type="button"
              >
                <CityIdentityIcon cityId={card.city.id} size="sm" />
                {card.city.name}
              </button>
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
