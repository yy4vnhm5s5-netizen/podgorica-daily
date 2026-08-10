import type { GoingOutEvent } from "../domain/going-out-event.ts";
import { selectUpcomingGoingOutEvents } from "../domain/going-out-event.ts";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out.ts";
import { isActiveCity, supportsCityCapability } from "@/shared/config/cities";
import type { City, CityContext } from "@/shared/types/city";

const goingOutDetailProvider = "montegigs" as const;

type GoingOutDetailProvider = typeof goingOutDetailProvider;

interface GoingOutDetailIdentity {
  provider: GoingOutDetailProvider;
  sourceEventId: string;
}

interface ResolvePublicGoingOutDetailInput {
  context: CityContext;
  eventKey: string;
  events: readonly GoingOutEvent[];
  now?: Date;
  state: GoingOutCacheState;
}

function createGoingOutDetailIdentity(
  event: Pick<GoingOutEvent, "sourceEventId" | "sourceName">,
): GoingOutDetailIdentity | undefined {
  if (event.sourceName !== "MonteGigs" || !isSourceEventId(event.sourceEventId)) return undefined;

  return { provider: goingOutDetailProvider, sourceEventId: event.sourceEventId };
}

function parseGoingOutDetailKey(value: string): GoingOutDetailIdentity | undefined {
  const match = /^montegigs-(\d+)$/u.exec(value);
  return match?.[1] ? { provider: goingOutDetailProvider, sourceEventId: match[1] } : undefined;
}

function isGoingOutEventDetailEligible(event: GoingOutEvent, city: City, now = new Date()) {
  return (
    isActiveCity(city) &&
    supportsCityCapability(city, "goingOut") &&
    event.city === city.id &&
    Boolean(createGoingOutDetailIdentity(event)) &&
    Boolean(event.title.trim()) &&
    Boolean(event.description?.trim()) &&
    selectUpcomingGoingOutEvents([event], now).length === 1
  );
}

function resolvePublicGoingOutDetail({
  context,
  eventKey,
  events,
  now,
  state,
}: ResolvePublicGoingOutDetailInput) {
  if (state === "unavailable") return undefined;

  const identity = parseGoingOutDetailKey(eventKey);
  if (!identity) return undefined;

  const event = events.find((candidate) => {
    const candidateIdentity = createGoingOutDetailIdentity(candidate);
    return (
      candidateIdentity?.provider === identity.provider &&
      candidateIdentity.sourceEventId === identity.sourceEventId
    );
  });

  return event && isGoingOutEventDetailEligible(event, context.city, now) ? event : undefined;
}

function isSourceEventId(value: string) {
  return /^\d+$/u.test(value);
}

export {
  createGoingOutDetailIdentity,
  goingOutDetailProvider,
  isGoingOutEventDetailEligible,
  parseGoingOutDetailKey,
  resolvePublicGoingOutDetail,
  type GoingOutDetailIdentity,
  type GoingOutDetailProvider,
  type ResolvePublicGoingOutDetailInput,
};
