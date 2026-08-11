import { z } from "zod";

import type {
  ParkingCatalogueLocation,
  ParkingSnapshotLocation,
} from "../domain/parking-availability.ts";

const parkingAvailabilitySourceUrl =
  "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php";
const parkingAvailabilityPageUrl = "https://parkingservispg.me/slobodna-mjesta/";
const parkingProviderId = "parking-servis-podgorica" as const;
const parkingCityId = "podgorica" as const;
const parkingAvailabilityMaximumResponseLength = 200_000;
const parkingTimestampClockSkewMs = 5 * 60_000;
const earliestPlausibleParkingTimestamp = Date.UTC(2000, 0, 1);

// These are the 14 location IDs that the official availability page itself targets with
// document.querySelector("#" + item.parking_id). Each label, type and capacity is copied from
// that same official public listing; the repeated HTML fallback number is deliberately absent.
const parkingCatalogue = [
  { capacity: 320, name: "Parking br. 1 – Kasarna Morača", sourceId: "broj1", type: "parking" },
  { capacity: 74, name: "Parking br. 2 – Beko", sourceId: "broj2", type: "parking" },
  { capacity: 24, name: "Parking br. 2a – Trg Balšića", sourceId: "broj2a", type: "parking" },
  { capacity: 84, name: "Parking br. 3 – Stadion zapad", sourceId: "broj3", type: "parking" },
  { capacity: 195, name: "Parking br. 5 – Sportski centar", sourceId: "broj5", type: "parking" },
  { capacity: 124, name: "Parking br. 6 – Mala pijaca", sourceId: "broj6", type: "parking" },
  { capacity: 170, name: "Parking br. 8 – KBC parking", sourceId: "broj8", type: "parking" },
  { capacity: 120, name: "Parking br. 9 – Pod Goricom", sourceId: "broj9", type: "parking" },
  {
    capacity: 45,
    name: "Parking br. 11 – Serdara Jola Piletića (kod Uprave policije)",
    sourceId: "broj11",
    type: "parking",
  },
  { capacity: 94, name: "Parking br. 12 – Blok V", sourceId: "broj12", type: "parking" },
  { capacity: 97, name: "Garaža br. 1 – Novaka Miloševa", sourceId: "garaza1", type: "garage" },
  { capacity: 109, name: "Garaža br. 2 – Karađorđeva", sourceId: "garaza2", type: "garage" },
  {
    capacity: 203,
    name: "Garaža br. 3 – arh. Milana Popovića",
    sourceId: "garaza3",
    type: "garage",
  },
  { capacity: 351, name: "Garaža br. 4 – TC Bazar", sourceId: "garaza4", type: "garage" },
] as const satisfies readonly ParkingCatalogueLocation[];

const parkingCatalogueBySourceId = new Map<string, ParkingCatalogueLocation>(
  parkingCatalogue.map((location) => [location.sourceId, location]),
);

const rawParkingRecordSchema = z
  .object({
    name: z.string().nullable().optional(),
    parking_id: z.string().trim().min(1),
    slobodnih_mjesta: z.number().finite().int(),
    time_updated: z.number().finite(),
  })
  .passthrough();

type FetchImplementation = (
  input: string,
  init: RequestInit,
) => Promise<{
  headers: { get(name: string): string | null };
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

interface ParkingServisHttpResponse {
  body: string;
  contentType: string | null;
  status: number;
}

interface ParkingServisHttpClient {
  get(): Promise<ParkingServisHttpResponse>;
}

interface ParkingParseResult {
  locations: readonly ParkingSnapshotLocation[];
  warnings: readonly string[];
}

class ParkingServisSourceError extends Error {
  readonly code:
    | "parking-response-invalid-json"
    | "parking-response-invalid-payload"
    | "parking-response-no-valid-locations"
    | "parking-response-too-large"
    | "parking-source-request-failed";

  constructor(
    code:
      | "parking-response-invalid-json"
      | "parking-response-invalid-payload"
      | "parking-response-no-valid-locations"
      | "parking-response-too-large"
      | "parking-source-request-failed",
  ) {
    super(code);
    this.name = "ParkingServisSourceError";
    this.code = code;
  }
}

function createParkingServisHttpClient({
  fetchImplementation = fetch,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
} = {}): ParkingServisHttpClient {
  return {
    async get() {
      let response: Awaited<ReturnType<FetchImplementation>>;
      try {
        response = await fetchImplementation(parkingAvailabilitySourceUrl, {
          headers: {
            Accept: "application/json, text/plain;q=0.9, */*;q=0.1",
            "User-Agent": "Gradom.me/1.0 (+https://gradom.me)",
          },
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new ParkingServisSourceError("parking-source-request-failed");
      }

      if (!response.ok) throw new ParkingServisSourceError("parking-source-request-failed");
      const body = await response.text();
      if (body.length > parkingAvailabilityMaximumResponseLength) {
        throw new ParkingServisSourceError("parking-response-too-large");
      }

      // The official endpoint currently declares text/html while returning valid JSON. Deliberately
      // parse text below instead of trusting this incorrect header or calling response.json().
      return {
        body,
        contentType: response.headers.get("content-type"),
        status: response.status,
      };
    },
  };
}

function parseParkingAvailabilityResponse(
  body: string,
  { now = new Date() }: { now?: Date } = {},
): ParkingParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    throw new ParkingServisSourceError("parking-response-invalid-json");
  }
  if (!Array.isArray(payload)) {
    throw new ParkingServisSourceError("parking-response-invalid-payload");
  }

  const warnings: string[] = [];
  const parsedRecords = payload.flatMap((rawRecord, index) => {
    const parsed = rawParkingRecordSchema.safeParse(rawRecord);
    if (!parsed.success) {
      warnings.push(`invalid-record:${index + 1}`);
      return [];
    }
    return [parsed.data];
  });
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const record of parsedRecords) {
    if (seenIds.has(record.parking_id)) duplicateIds.add(record.parking_id);
    seenIds.add(record.parking_id);
  }
  if (duplicateIds.size > 0) warnings.push(`duplicate-parking-id:${duplicateIds.size}`);

  const locations: ParkingSnapshotLocation[] = [];
  let invalidCapacityCount = 0;
  let invalidTimestampCount = 0;
  let unknownLocationCount = 0;

  for (const record of parsedRecords) {
    if (duplicateIds.has(record.parking_id)) continue;

    const catalogueLocation = parkingCatalogueBySourceId.get(record.parking_id);
    if (!catalogueLocation) {
      unknownLocationCount += 1;
      continue;
    }
    if (record.slobodnih_mjesta < 0 || record.slobodnih_mjesta > catalogueLocation.capacity) {
      invalidCapacityCount += 1;
      continue;
    }

    const timestamp = new Date(record.time_updated * 1_000);
    if (
      !Number.isInteger(record.time_updated) ||
      timestamp.getTime() < earliestPlausibleParkingTimestamp ||
      timestamp.getTime() > now.getTime() + parkingTimestampClockSkewMs
    ) {
      invalidTimestampCount += 1;
      continue;
    }

    locations.push({
      freeSpaces: record.slobodnih_mjesta,
      sourceId: record.parking_id,
      sourceUpdatedAt: timestamp.toISOString(),
    });
  }

  if (unknownLocationCount > 0) warnings.push(`unknown-parking-id:${unknownLocationCount}`);
  if (invalidCapacityCount > 0) warnings.push(`invalid-free-spaces:${invalidCapacityCount}`);
  if (invalidTimestampCount > 0) warnings.push(`invalid-timestamp:${invalidTimestampCount}`);
  const missingExpectedLocations = parkingCatalogue.length - locations.length;
  if (missingExpectedLocations > 0) {
    warnings.push(`missing-expected-locations:${missingExpectedLocations}`);
  }

  // A syntactically valid array containing no usable, recognised location is source degradation,
  // not a legitimate availability update. Retain the last known snapshot rather than replacing
  // every location with a misleading blank state after an upstream schema change.
  if (locations.length === 0) {
    throw new ParkingServisSourceError("parking-response-no-valid-locations");
  }

  return { locations, warnings };
}

function getParkingCatalogueLocation(sourceId: string) {
  return parkingCatalogueBySourceId.get(sourceId);
}

export {
  createParkingServisHttpClient,
  getParkingCatalogueLocation,
  parkingAvailabilityPageUrl,
  parkingAvailabilitySourceUrl,
  parkingCatalogue,
  parkingCityId,
  parkingProviderId,
  parseParkingAvailabilityResponse,
  ParkingServisSourceError,
  type ParkingParseResult,
  type ParkingServisHttpClient,
  type ParkingServisHttpResponse,
};
