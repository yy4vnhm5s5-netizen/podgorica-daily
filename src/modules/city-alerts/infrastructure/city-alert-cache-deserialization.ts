import type { CityAlert, CityAlertContent } from "../domain/city-alert.ts";
import { isCityId } from "../../../shared/config/cities.ts";
import type { CityId } from "../../../shared/types/city.ts";

function deserializeCityAlerts(value: unknown): CityAlert[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const alerts = value.map(deserializeCityAlert);
  return alerts.every((alert): alert is CityAlert => alert !== undefined) ? alerts : undefined;
}

function deserializeCityAlert(value: unknown): CityAlert | undefined {
  if (!isRecord(value)) return undefined;

  const affectedArea = deserializeCityAlertContent(value.affectedArea);
  const cityIds = deserializeCityIds(value.cityIds);
  const description = deserializeCityAlertContent(value.description);
  const expectedEndAt = deserializeOptionalDate(value.expectedEndAt);
  const publishedAt = deserializeOptionalDate(value.publishedAt);
  const source = deserializeCityAlertContent(value.source);
  const startsAt = deserializeOptionalDate(value.startsAt);
  const title = deserializeCityAlertContent(value.title);

  if (
    !affectedArea ||
    !cityIds ||
    !description ||
    expectedEndAt === null ||
    publishedAt === null ||
    !source ||
    startsAt === null ||
    !title ||
    !isAlertDataMode(value.dataMode) ||
    !isAlertSeverity(value.severity) ||
    !isAlertStatus(value.status) ||
    !isAlertType(value.type) ||
    !isString(value.id) ||
    !isOptionalString(value.rawSourceText) ||
    !isOptionalString(value.sourceUrl)
  ) {
    return undefined;
  }

  return {
    affectedArea,
    cityIds,
    dataMode: value.dataMode,
    description,
    ...(expectedEndAt ? { expectedEndAt } : {}),
    id: value.id,
    ...(publishedAt ? { publishedAt } : {}),
    ...(value.rawSourceText ? { rawSourceText: value.rawSourceText } : {}),
    severity: value.severity,
    source,
    ...(value.sourceUrl ? { sourceUrl: value.sourceUrl } : {}),
    ...(startsAt ? { startsAt } : {}),
    status: value.status,
    title,
    type: value.type,
  };
}

function deserializeCityAlertContent(value: unknown): CityAlertContent | undefined {
  if (!isRecord(value) || !isString(value.kind)) return undefined;
  if (value.kind === "demo" && isString(value.key)) return { key: value.key, kind: "demo" };
  if (value.kind === "source" && isString(value.value))
    return { kind: "source", value: value.value };
  return undefined;
}

function deserializeCityIds(value: unknown): CityId[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const cityIds: CityId[] = [];
  for (const cityId of value) {
    if (!isString(cityId) || !isCityId(cityId)) return undefined;
    cityIds.push(cityId);
  }
  return cityIds;
}

function deserializeOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!isString(value)) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAlertDataMode(value: unknown): value is CityAlert["dataMode"] {
  return value === "demo" || value === "live";
}

function isAlertSeverity(value: unknown): value is CityAlert["severity"] {
  return (
    value === "critical" || value === "information" || value === "resolved" || value === "warning"
  );
}

function isAlertStatus(value: unknown): value is CityAlert["status"] {
  return value === "active" || value === "expired" || value === "scheduled";
}

function isAlertType(value: unknown): value is CityAlert["type"] {
  return (
    value === "emergency" ||
    value === "powerOutage" ||
    value === "waterOutage" ||
    value === "weatherWarning"
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export { deserializeCityAlerts };
