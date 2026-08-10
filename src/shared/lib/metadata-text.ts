import { getCityName } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

function normalizeMetadataText(value: string | undefined) {
  if (!value) return undefined;

  const normalized = value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();

  return normalized || undefined;
}

function truncateMetadataText(value: string, maximumLength: number) {
  if (value.length <= maximumLength) return value;

  const withoutTrailingSpace = value.slice(0, maximumLength - 1).trimEnd();
  const lastWordBoundary = withoutTrailingSpace.lastIndexOf(" ");
  const shortened =
    lastWordBoundary > 0 ? withoutTrailingSpace.slice(0, lastWordBoundary) : withoutTrailingSpace;

  return `${shortened}…`;
}

function addCityContextToMetadataTitle(title: string, city: City) {
  const cityForms = new Set([
    getCityName(city),
    getCityName(city, "locative"),
    getCityName(city, "accusative"),
  ]);
  const mentionsCity = [...cityForms].some((form) =>
    new RegExp(`(^|\\P{L})${escapeRegExpLiteral(form)}(\\P{L}|$)`, "iu").test(title),
  );

  return mentionsCity ? title : `${title} — ${getCityName(city)}`;
}

function escapeRegExpLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { addCityContextToMetadataTitle, normalizeMetadataText, truncateMetadataText };
