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
  const message = typeof payload.message === "string" && payload.message.trim() ? payload.message : event;
  return { ...payload, level, message };
}

export { emitError, emitInfo, emitInfoMessage, type EventRefreshLogPayload };
