import { NextResponse } from "next/server";

import { getDefaultCityContext } from "@/config/city-context";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { getEventsReadiness } from "@/modules/events/application/readiness";

export async function GET() {
  try {
    const events = await getCityEvents(getDefaultCityContext());
    const readiness = getEventsReadiness(events.providers);

    return NextResponse.json(readiness, { status: readiness.status === "unavailable" ? 503 : 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
