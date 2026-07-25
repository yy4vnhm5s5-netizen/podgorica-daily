import type { EventCacheSnapshot } from "@/modules/events/infrastructure/events-cache";
import type { PodgoricaFlightsCacheSnapshot } from "@/modules/flights/infrastructure/podgorica-flights";
import type { ZpcgRailwayCacheSnapshot } from "@/modules/transport/infrastructure/zpcg-railway";
import { selectUpcomingFlights } from "@/modules/flights/domain/flight";
import { selectHomepageCinemaProgramme } from "@/modules/events/presentation/cineplexx-programme-ui-model";
import { selectUpcomingRailwayDepartures } from "@/modules/transport/domain/railway-departure";
import { env } from "@/config/env";
import {
  createFileSnapshotDiagnostic,
  emitSnapshotDiagnostics,
  type FileSnapshotDiagnostic,
} from "@/shared/lib/snapshot-diagnostics";

type FileBackedSnapshotDiagnostics = Record<
  "cineplexx" | "flights" | "railway",
  FileSnapshotDiagnostic
>;

interface FileBackedSnapshotDiagnosticPaths {
  cineplexx: string;
  flights: string;
  railway: string;
}

async function getFileBackedSnapshotDiagnostics(
  now = new Date(),
  cachePaths: FileBackedSnapshotDiagnosticPaths = {
    cineplexx: env.CINEPLEXX_EVENT_CACHE_PATH,
    flights: env.PODGORICA_FLIGHTS_CACHE_PATH,
    railway: env.ZPCG_RAILWAY_CACHE_PATH,
  },
): Promise<FileBackedSnapshotDiagnostics> {
  const [flights, railway, cineplexx] = await Promise.all([
    createFileSnapshotDiagnostic<
      PodgoricaFlightsCacheSnapshot,
      PodgoricaFlightsCacheSnapshot["flights"][number]
    >({
      cachePath: cachePaths.flights,
      getDisplayableRecordCount: (flights) =>
        selectUpcomingFlights(flights, now, Number.MAX_SAFE_INTEGER).length,
      getFetchedAt: (snapshot) => snapshot.fetchedAt,
      getRecords: (snapshot) => snapshot.flights,
      getRelevantTimestamp: (flight) => flight.scheduledAt,
      now,
      relevantTimestampTimeZone: "UTC",
    }),
    createFileSnapshotDiagnostic<
      ZpcgRailwayCacheSnapshot,
      ZpcgRailwayCacheSnapshot["departures"][number]
    >({
      cachePath: cachePaths.railway,
      getDisplayableRecordCount: (departures) =>
        selectUpcomingRailwayDepartures(departures, now, Number.MAX_SAFE_INTEGER).length,
      getFetchedAt: (snapshot) => snapshot.fetchedAt,
      getRecords: (snapshot) => snapshot.departures,
      getRelevantTimestamp: (departure) => `${departure.departureDate}T${departure.departureTime}`,
      now,
      relevantTimestampTimeZone: "Europe/Podgorica",
    }),
    createFileSnapshotDiagnostic<EventCacheSnapshot, EventCacheSnapshot["events"][number]>({
      cachePath: cachePaths.cineplexx,
      getDisplayableRecordCount: (events) =>
        selectHomepageCinemaProgramme(events, { now, timeZone: "Europe/Podgorica" }).events.length,
      getFetchedAt: (snapshot) => snapshot.fetchedAt,
      getRecords: (snapshot) => snapshot.events,
      getRelevantTimestamp: (event) => event.startsAt,
      now,
      relevantTimestampTimeZone: "UTC",
    }),
  ]);

  return { cineplexx, flights, railway };
}

async function collectAndEmitFileBackedSnapshotDiagnostics(now = new Date()) {
  const snapshots = await getFileBackedSnapshotDiagnostics(now);
  emitSnapshotDiagnostics(snapshots);
  return snapshots;
}

export {
  collectAndEmitFileBackedSnapshotDiagnostics,
  getFileBackedSnapshotDiagnostics,
  type FileBackedSnapshotDiagnosticPaths,
  type FileBackedSnapshotDiagnostics,
};
