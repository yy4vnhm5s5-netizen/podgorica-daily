type ParkingLocationType = "garage" | "parking";

type ParkingAvailabilityState = "fresh" | "stale" | "unavailable";

interface ParkingCatalogueLocation {
  capacity: number;
  name: string;
  sourceId: string;
  type: ParkingLocationType;
}

interface ParkingSnapshotLocation {
  freeSpaces: number;
  sourceId: string;
  sourceUpdatedAt: string;
}

interface ParkingAvailabilitySnapshot {
  cityId: "podgorica";
  fetchedAt: string;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  locations: readonly ParkingSnapshotLocation[];
  provider: "parking-servis-podgorica";
  schemaVersion: 1;
  sourceUrl: string;
}

interface ParkingLocationReadModel extends ParkingCatalogueLocation {
  availabilityState: ParkingAvailabilityState;
  freeSpaces?: number;
  sourceUpdatedAt?: string;
}

interface ParkingAvailabilityReadModel {
  fetchedAt?: string;
  lastSuccessfulRefreshAt?: string;
  locations: readonly ParkingLocationReadModel[];
  state: "fresh" | "stale" | "unavailable";
}

export {
  type ParkingAvailabilityReadModel,
  type ParkingAvailabilitySnapshot,
  type ParkingAvailabilityState,
  type ParkingCatalogueLocation,
  type ParkingLocationReadModel,
  type ParkingLocationType,
  type ParkingSnapshotLocation,
};
