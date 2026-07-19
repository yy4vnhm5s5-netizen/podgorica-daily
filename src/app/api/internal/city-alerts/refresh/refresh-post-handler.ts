import { isRefreshAuthorized } from "../../../../../shared/lib/refresh-auth.ts";

interface RefreshPostHandlerDependencies {
  refresh: () => Promise<{ state: "already-running" | "failure" | "partial" | "success" }>;
  secret?: string;
}

function createRefreshPostHandler({ refresh, secret }: RefreshPostHandlerDependencies) {
  return async function post(request: Request) {
    if (!secret || secret.trim().length !== secret.length) {
      return Response.json({ code: "REFRESH_NOT_CONFIGURED", status: "error" }, { status: 500 });
    }
    if (!isRefreshAuthorized(request.headers.get("authorization"), secret)) {
      return Response.json({ code: "UNAUTHORIZED", status: "error" }, { status: 401 });
    }
    try {
      const summary = await refresh();
      const status =
        summary.state === "success"
          ? 200
          : summary.state === "partial"
            ? 207
            : summary.state === "already-running"
              ? 409
              : 500;
      return Response.json(summary, { status });
    } catch {
      return Response.json({ code: "REFRESH_INTERNAL_ERROR", status: "error" }, { status: 500 });
    }
  };
}

export { createRefreshPostHandler };
