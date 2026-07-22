import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import type { Locale } from "@/shared/config/locale";

const powerOutageDetailsLabels = {
  en: "View details →",
  me: "Pogledajte detalje →",
} as const;

interface PowerOutageDateGroup {
  date?: Date;
  key: string;
  outages: readonly CityAlert[];
}

interface AdditionalLocationsTemplates {
  few: string;
  many: string;
  one: string;
}

interface PowerOutageSummaryTemplates {
  days: {
    many: string;
    one: string;
  };
  outages: {
    many: string;
    one: string;
  };
}

function formatAdditionalLocations(
  count: number,
  templates: AdditionalLocationsTemplates,
  locale: "en" | "me",
) {
  if (locale === "en") {
    return (count === 1 ? templates.one : templates.many).replace("{count}", String(count));
  }

  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const template =
    modulo100 >= 11 && modulo100 <= 14
      ? templates.many
      : modulo10 === 1
        ? templates.one
        : modulo10 >= 2 && modulo10 <= 4
          ? templates.few
          : templates.many;

  return template.replace("{count}", String(count));
}

function getPowerOutageDetailsLabel(locale: "en" | "me") {
  return powerOutageDetailsLabels[locale];
}

function formatPowerOutageSummary(
  outageCount: number,
  dayCount: number,
  templates: PowerOutageSummaryTemplates,
  locale: Locale,
) {
  const outages = (
    usesSingularOutageForm(outageCount, locale) ? templates.outages.one : templates.outages.many
  ).replace("{count}", String(outageCount));

  if (dayCount === 0) {
    return outages;
  }

  const days = (dayCount === 1 ? templates.days.one : templates.days.many).replace(
    "{count}",
    String(dayCount),
  );

  return `${outages} ${days}`;
}

function usesSingularOutageForm(count: number, locale: Locale) {
  if (locale === "en") {
    return count === 1;
  }

  const modulo100 = count % 100;
  const modulo10 = count % 10;

  return modulo10 === 1 && !(modulo100 >= 11 && modulo100 <= 14);
}

function getPowerOutageOfficialSourceUrl(alert: CityAlert) {
  return alert.sourceUrl;
}

function groupPowerOutagesByDate(
  outages: readonly CityAlert[],
  timeZone = "Europe/Podgorica",
): readonly PowerOutageDateGroup[] {
  const groups = new Map<string, { date?: Date; key: string; outages: CityAlert[] }>();

  for (const outage of outages) {
    const date = outage.startsAt ?? outage.publishedAt;

    const key = date ? getLocalDateKey(date, timeZone) : "date-unavailable";
    const group = groups.get(key);

    if (group) {
      group.outages.push(outage);
    } else {
      groups.set(key, { date, key, outages: [outage] });
    }
  }

  return [...groups.values()]
    .toSorted((left, right) => getGroupTime(left.date) - getGroupTime(right.date))
    .map(({ date, key, outages }) => ({
      date,
      key,
      outages: outages.toSorted((left, right) => getOutageTime(left) - getOutageTime(right)),
    }));
}

function normalizePowerOutageDescription(value: string) {
  return value
    .replace(/\bod\s+od\b/giu, "od")
    .replace(/\s+/gu, " ")
    .trim();
}

function getLocalDateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getOutageTime(alert: CityAlert) {
  return alert.startsAt?.getTime() ?? alert.publishedAt?.getTime() ?? Number.POSITIVE_INFINITY;
}

function getGroupTime(value: Date | undefined) {
  return value?.getTime() ?? Number.POSITIVE_INFINITY;
}

export {
  formatAdditionalLocations,
  formatPowerOutageSummary,
  getPowerOutageDetailsLabel,
  getPowerOutageOfficialSourceUrl,
  groupPowerOutagesByDate,
  normalizePowerOutageDescription,
  type PowerOutageDateGroup,
};
