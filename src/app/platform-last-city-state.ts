const lastCityStorageKey = "gradom:last-active-city";

function getStoredActiveCityId(value: string | null, activeCityIds: readonly string[]) {
  return value && activeCityIds.includes(value) ? value : undefined;
}

export { getStoredActiveCityId, lastCityStorageKey };
