import { isRefreshAuthorized } from "@/shared/lib/refresh-auth";

type RefreshEndpointState =
  | "already-running"
  | "bad-request"
  | "failure"
  | "operational-failure"
  | "partial"
  | "retained"
  | "success"
  | "unavailable"
  | "upstream-unavailable";

interface RefreshEndpointResult {
  state: RefreshEndpointState;
}

interface RefreshPostHandlerDependencies<TResult extends RefreshEndpointResult> {
  refresh: (request: Request) => Promise<TResult>;
  secret?: string;
}

function createRefreshPostHandler<TResult extends RefreshEndpointResult>({
  refresh,
  secret,
}: RefreshPostHandlerDependencies<TResult>) {
  return async function post(request: Request) {
    if (!secret || secret.trim().length !== secret.length) {
      return Response.json({ code: "REFRESH_NOT_CONFIGURED", status: "error" }, { status: 500 });
    }
    if (!isRefreshAuthorized(request.headers.get("authorization"), secret)) {
      return Response.json({ code: "UNAUTHORIZED", status: "error" }, { status: 401 });
    }

    try {
      const summary = await refresh(request);
      return Response.json(summary, { status: getRefreshResponseStatus(summary.state) });
    } catch {
      return Response.json({ code: "REFRESH_INTERNAL_ERROR", status: "error" }, { status: 500 });
    }
  };
}

function getRefreshResponseStatus(state: RefreshEndpointState) {
  if (state === "bad-request") return 400;
  if (state === "already-running") return 409;
  if (
    state === "success" ||
    state === "partial" ||
    state === "retained" ||
    state === "upstream-unavailable"
  ) {
    return 200;
  }
  // "unavailable" and "failure" are the original, unclassified provider-degradation states:
  // most producers of them (going-out, zpcg, sea-water-quality, cedis, vikpg, cineplexx,
  // standard-events) fold a genuine upstream failure and a local operational fault (e.g. a cache
  // write that threw, or an unexpected exception caught and turned into a result) into the same
  // literal, so this status code cannot tell them apart yet — fail closed (500) rather than risk
  // hiding a real fault as a routine 200. Only Flights has been audited error-code by error-code
  // (see toFlightsRefreshEndpointResult) and split into "upstream-unavailable" (safe, 200) vs
  // "operational-failure" (a real fault, 500 here too) — extending that same audit to the other
  // providers is a separate, not-yet-done piece of work.
  return 500;
}

export {
  createRefreshPostHandler,
  getRefreshResponseStatus,
  type RefreshEndpointResult,
  type RefreshEndpointState,
};
