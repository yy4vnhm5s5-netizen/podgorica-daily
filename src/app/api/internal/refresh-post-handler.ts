import { isRefreshAuthorized } from "@/shared/lib/refresh-auth";

type RefreshEndpointState =
  "already-running" | "failure" | "partial" | "retained" | "success" | "unavailable";

interface RefreshEndpointResult {
  state: RefreshEndpointState;
}

interface RefreshPostHandlerDependencies<TResult extends RefreshEndpointResult> {
  refresh: () => Promise<TResult>;
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
      const summary = await refresh();
      return Response.json(summary, { status: getRefreshResponseStatus(summary.state) });
    } catch {
      return Response.json({ code: "REFRESH_INTERNAL_ERROR", status: "error" }, { status: 500 });
    }
  };
}

function getRefreshResponseStatus(state: RefreshEndpointState) {
  if (state === "success") return 200;
  if (state === "partial" || state === "retained") return 207;
  if (state === "already-running") return 409;
  return 500;
}

export {
  createRefreshPostHandler,
  getRefreshResponseStatus,
  type RefreshEndpointResult,
  type RefreshEndpointState,
};
