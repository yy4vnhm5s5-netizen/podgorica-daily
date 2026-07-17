import { createHash } from "node:crypto";

import type { RoadAlert, RoadAlertType } from "../domain/road-alert.ts";
import { amscgRoadConditionsUrl } from "./amscg-http-client.ts";

interface AmscgParseResult {
  alerts: RoadAlert[];
  contentRecognized: boolean;
  warnings: string[];
}

const classificationRules: ReadonlyArray<[RoadAlertType, RegExp]> = [
  ["closure", /\bobustav(?:a|ljen|lja)?\b|\bzatvoren\b/i],
  ["alternating", /naizmjenič/i],
  ["restriction", /\bzabran\w*\b|\bograničen\w*\b|\brestrikc\w*\b/i],
  ["roadwork", /\bradov\w*\b|\brekonstrukcij\w*\b/i],
  ["warning", /\boprez\w*\b|\bupozor\w*\b|\bodron\w*\b|\bmagl\w*\b|\bkolovoz\w*\b/i],
];

function parseAmscgRoadConditions(
  html: string,
  sourceUrl = amscgRoadConditionsUrl,
): AmscgParseResult {
  const entries = extractTextEntries(html);
  if (entries.length === 0) {
    return { alerts: [], contentRecognized: false, warnings: ["article-content-unrecognized"] };
  }

  const alerts = entries.flatMap((entry) => normalizeRoadAlert(entry, sourceUrl));
  return { alerts: deduplicateAlerts(alerts), contentRecognized: true, warnings: [] };
}

function normalizeRoadAlert(entry: string, sourceUrl: string): RoadAlert[] {
  const type = classificationRules.find(([, pattern]) => pattern.test(entry))?.[0];
  if (!type) return [];

  const affectedRoad = extractAffectedRoad(entry);
  if (!affectedRoad) return [];
  const validity = parseValidity(entry);
  const id = createHash("sha256")
    .update(`${sourceUrl}|${type}|${normalize(affectedRoad)}|${normalize(entry)}`)
    .digest("hex");

  return [
    {
      affectedRoad,
      description: entry,
      id,
      municipality: extractMunicipality(entry),
      source: "AMSCG",
      sourceUrl,
      title: getTitle(type),
      type,
      ...validity,
    },
  ];
}

function extractTextEntries(html: string) {
  return html
    .replace(/<\/(?:p|li|h[1-6]|div|br)\s*>/gi, "__ENTRY__")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .split("__ENTRY__")
    .map(normalize)
    .filter((entry) => entry.length > 15);
}

function extractAffectedRoad(value: string) {
  const road =
    /\b(?:magistralnom|regionalnom) putu?\s+([^,.;:]+(?:\s*[-–]\s*[^,.;:]+)?)/i.exec(value)?.[1] ??
    /\b(?:putnom pravcu|dionici)\s+([^,.;:]+)/i.exec(value)?.[1];
  return road ? normalize(road) : null;
}

function extractMunicipality(value: string) {
  return /\b(Podgorica|Nikšić|Danilovgrad|Cetinje|Kolašin|Herceg Novi|Bar|Budva|Kotor|Tivat|Ulcinj|Pljevlja|Bijelo Polje|Berane|Rožaje|Plav|Gusinje|Mojkovac|Šavnik|Žabljak|Tuzi|Zeta)\b/i.exec(
    value,
  )?.[1];
}

function parseValidity(value: string) {
  const match = /\bod\s+(\d{1,2})[.:](\d{2})\s+(?:do|–|-)\s+(\d{1,2})[.:](\d{2})/i.exec(value);
  if (!match) return {};
  return { validity: match[0] };
}

function getTitle(type: RoadAlertType) {
  return (
    {
      alternating: "Naizmjenično odvijanje saobraćaja",
      closure: "Obustava saobraćaja",
      restriction: "Ograničenje saobraćaja",
      roadwork: "Radovi na putu",
      warning: "Važno upozorenje za vozače",
    } satisfies Record<RoadAlertType, string>
  )[type];
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function deduplicateAlerts(alerts: RoadAlert[]) {
  return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
}

export { parseAmscgRoadConditions, type AmscgParseResult };
