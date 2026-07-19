const maximumEventSummaryLength = 500;

function getEventSummary(description: string | undefined) {
  if (!description) return undefined;

  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumEventSummaryLength) return normalized || undefined;

  const shortened = normalized.slice(0, maximumEventSummaryLength);
  return `${shortened.slice(0, shortened.lastIndexOf(" ")).trim()}…`;
}

export { getEventSummary, maximumEventSummaryLength };
