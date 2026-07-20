type EventRefreshLogPayload = Record<string, unknown>;

function emitInfo(payload: EventRefreshLogPayload): void {
  console.info(serializePayload(withRailwayMessage(payload, "info")));
}

function emitError(payload: EventRefreshLogPayload): void {
  console.error(serializePayload(withRailwayMessage(payload, "error")));
}

function emitInfoMessage(message: string): void {
  if (!message.trim()) throw new Error("Event refresh log messages must not be empty.");
  console.info(message);
}

function serializePayload(payload: EventRefreshLogPayload): string {
  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("Event refresh diagnostics must be plain objects.");

  const serialized = JSON.stringify(payload);
  if (typeof serialized !== "string" || !serialized.trim())
    throw new Error("Event refresh diagnostics could not be serialized.");

  return serialized;
}

function withRailwayMessage(
  payload: EventRefreshLogPayload,
  level: "error" | "info",
): EventRefreshLogPayload {
  const event = typeof payload.event === "string" ? payload.event : "events-diagnostic";
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : createReadableMessage(event, payload);
  return { ...payload, level, message };
}

function createReadableMessage(event: string, payload: EventRefreshLogPayload): string {
  if (event === "events-refresh-parsed-sample") return createParsedSampleMessage(event, payload);
  if (event === "events-refresh-pipeline")
    return appendDetails(event, payload, [
      ["provider", "provider"],
      ["fetched", "fetchedCount"],
      ["parsed", "parsedCount"],
      ["normalized", "normalizedCount"],
      ["accepted", "acceptedCount"],
      ["rejected", "rejectedCount"],
    ]);
  if (event === "events-refresh-rejected-event") {
    const reasons = Array.isArray(payload.reasons)
      ? payload.reasons.filter((reason): reason is string => typeof reason === "string").join(",")
      : undefined;
    return appendDetails(event, { ...payload, reasons }, [
      ["provider", "provider"],
      ["reasons", "reasons"],
      ["eventId", "eventId"],
    ]);
  }
  if (event === "events-refresh-provider-completed")
    return appendDetails(event, payload, [
      ["provider", "provider"],
      ["accepted", "acceptedCount"],
      ["rejected", "rejectedCount"],
      ["state", "state"],
      ["cache", "cacheOutcome"],
    ]);
  if (event === "events-refresh-provider-failed") {
    const error = isRecord(payload.error) && typeof payload.error.name === "string"
      ? payload.error.name
      : undefined;
    return appendDetails(event, { ...payload, error }, [
      ["provider", "provider"],
      ["error", "error"],
    ]);
  }
  if (event === "events-refresh-completed")
    return appendDetails(event, payload, [
      ["state", "state"],
      ["providers", "providerCount"],
    ]);
  if (event === "events-refresh-started") {
    const providers = Array.isArray(payload.providers)
      ? payload.providers.filter((provider): provider is string => typeof provider === "string").join(",")
      : undefined;
    return appendDetails(event, { ...payload, providers }, [["providers", "providers"]]);
  }
  if (event === "cineplexx-refresh-failed") {
    const error = isRecord(payload.error) ? payload.error : {};
    const message = appendDetails(
      event,
      { ...payload, errorClass: error.class, errorMessage: error.message },
      [
        ["phase", "phase"],
        ["errorClass", "errorClass"],
        ["errorMessage", "errorMessage"],
        ["causeClass", "causeClass"],
        ["cause", "causeMessage"],
        ["chromiumMissing", "chromiumExecutableMissing"],
      ],
    );
    return appendCineplexxDomDetails(message, payload.dom);
  }
  if (event === "cineplexx-refresh-zero-screenings") {
    const message = appendDetails(event, payload, [
      ["phase", "phase"],
      ["reason", "reason"],
    ]);
    return appendCineplexxDomDetails(message, payload.dom);
  }
  return event;
}

function appendCineplexxDomDetails(message: string, value: unknown): string {
  if (!isRecord(value)) return message;
  const title = typeof value.title === "string" ? value.title : "";
  const finalUrl = typeof value.finalUrl === "string" ? value.finalUrl : "";
  const htmlLength = typeof value.htmlLength === "number" ? value.htmlLength : "";
  const sessions =
    typeof value.expectedSessionSelectorExists === "boolean"
      ? value.expectedSessionSelectorExists
      : "";
  const bookings =
    typeof value.expectedBookingSelectorExists === "boolean"
      ? value.expectedBookingSelectorExists
      : "";
  return `${message} title=${quoteMessageValue(title)} finalUrl=${quoteMessageValue(finalUrl)} htmlLength=${htmlLength} sessions=${sessions} bookings=${bookings}`;
}

function createParsedSampleMessage(event: string, payload: EventRefreshLogPayload): string {
  const sample = isRecord(payload.sample) ? payload.sample : {};
  const provider = readMessageValue(payload.provider);
  const parsedCount = readMessageValue(payload.parsedCount);
  const warnings = Array.isArray(sample.parserWarnings)
    ? sample.parserWarnings
        .filter((warning): warning is string => typeof warning === "string")
        .slice(0, 3)
        .map((warning) => compactMessageValue(warning))
        .join(", ")
    : "";

  return [
    event,
    `provider=${provider}`,
    `parsed=${parsedCount}`,
    `title=${quoteMessageValue(sample.rawTitle)}`,
    `dateText=${quoteMessageValue(sample.rawDateText)}`,
    `timeText=${quoteMessageValue(sample.rawTimeText)}`,
    `startDate=${quoteMessageValue(sample.startDate)}`,
    `startsAt=${quoteMessageValue(sample.startsAt)}`,
    `venue=${quoteMessageValue(sample.rawVenue)}`,
    `warnings=${quoteMessageValue(warnings)}`,
  ].join(" ");
}

function readMessageValue(value: unknown): string {
  return typeof value === "number" || typeof value === "string" ? compactMessageValue(String(value)) : "";
}

function quoteMessageValue(value: unknown): string {
  return `"${compactMessageValue(typeof value === "string" ? value : "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function compactMessageValue(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 79)}…` : compact;
}

function appendDetails(
  event: string,
  payload: EventRefreshLogPayload,
  fields: readonly [label: string, key: string][],
): string {
  const details = fields.flatMap(([label, key]) => {
    const value = payload[key];
    return typeof value === "number" || typeof value === "boolean" || (typeof value === "string" && value.trim())
      ? [`${label}=${compactMessageValue(String(value))}`]
      : [];
  });
  return details.length ? `${event} ${details.join(" ")}` : event;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export { emitError, emitInfo, emitInfoMessage, type EventRefreshLogPayload };
