import { vikpgOrigin } from "./vikpg-water-notices.ts";

interface VikpgHttpClient {
  get(url: string): Promise<string>;
}

interface FetchResponse {
  ok: boolean;
  redirected?: boolean;
  status: number;
  text(): Promise<string>;
  url?: string;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

interface VikpgHttpClientOptions {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
}

type VikpgFetchErrorCode =
  | "vikpg-empty-response"
  | "vikpg-host-rejected"
  | "vikpg-http-error"
  | "vikpg-network-error"
  | "vikpg-request-timeout";

// Coarse, non-identifying bucket for the underlying Node/undici error code — enough to tell a DNS
// failure from a reset connection from a TLS problem in diagnostics without exposing raw error
// internals.
type VikpgNetworkErrorType = "connection-reset" | "dns" | "tls" | "unknown";

interface VikpgFetchErrorOptions {
  emptyBody?: boolean;
  finalUrl?: string;
  httpStatus?: number;
  networkErrorType?: VikpgNetworkErrorType;
  redirected?: boolean;
  responseBodyPreview?: string;
}

class VikpgFetchError extends Error {
  readonly code: VikpgFetchErrorCode;
  readonly emptyBody?: boolean;
  readonly finalUrl?: string;
  readonly httpStatus?: number;
  readonly networkErrorType?: VikpgNetworkErrorType;
  readonly redirected?: boolean;
  readonly responseBodyPreview?: string;

  constructor(
    code: VikpgFetchErrorCode,
    message: string,
    {
      emptyBody,
      finalUrl,
      httpStatus,
      networkErrorType,
      redirected,
      responseBodyPreview,
    }: VikpgFetchErrorOptions = {},
  ) {
    super(message);
    this.name = "VikpgFetchError";
    this.code = code;
    this.emptyBody = emptyBody;
    this.finalUrl = finalUrl;
    this.httpStatus = httpStatus;
    this.networkErrorType = networkErrorType;
    this.redirected = redirected;
    this.responseBodyPreview = responseBodyPreview;
  }
}

const defaultUserAgent = "Gradom/0.1 (+https://gradom.me)";
const maximumBodyPreviewLength = 200;

function createVikpgHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
  userAgent = defaultUserAgent,
}: VikpgHttpClientOptions = {}): VikpgHttpClient {
  return {
    async get(url: string) {
      assertVikpgUrl(url);
      const attempts = Math.max(0, retries) + 1;
      let latestError: VikpgFetchError | undefined;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const finalUrl = getSafeFinalUrl(response.url) ?? getSafeFinalUrl(url);
          const redirected = response.redirected;
          if (response.ok) {
            const body = await response.text();
            if (body.trim()) return body;
            latestError = new VikpgFetchError(
              "vikpg-empty-response",
              "VIK returned an empty page.",
              { emptyBody: true, finalUrl, httpStatus: response.status, redirected },
            );
          } else {
            latestError = new VikpgFetchError(
              "vikpg-http-error",
              `VIK returned HTTP ${response.status}.`,
              {
                finalUrl,
                httpStatus: response.status,
                redirected,
                responseBodyPreview: sanitizeBodyPreview(await safeReadText(response)),
              },
            );
            if (response.status !== 429 && response.status < 500) break;
          }
        } catch (error) {
          latestError = isAbortError(error)
            ? new VikpgFetchError("vikpg-request-timeout", "VIK request timed out.")
            : new VikpgFetchError("vikpg-network-error", "VIK request failed.", {
                networkErrorType: classifyNetworkError(error),
              });
        }
      }
      throw latestError ?? new VikpgFetchError("vikpg-network-error", "VIK request failed.");
    },
  };
}

function assertVikpgUrl(value: string) {
  try {
    const url = new URL(value);
    const origin = new URL(vikpgOrigin);
    if (
      url.protocol !== "https:" ||
      ![origin.hostname, `www.${origin.hostname}`].includes(url.hostname)
    ) {
      throw new Error();
    }
  } catch {
    throw new VikpgFetchError("vikpg-host-rejected", "VIK URL host is not allowed.");
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

// Node/undici nests the low-level cause inside `error.cause`; walk a few levels without assuming
// its exact shape.
function getNestedErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    if ("code" in current && typeof current.code === "string") return current.code;
    if (!("cause" in current)) return undefined;
    current = current.cause;
  }
  return undefined;
}

function classifyNetworkError(error: unknown): VikpgNetworkErrorType {
  const code = getNestedErrorCode(error);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") return "dns";
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    code === "EPROTO" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ) {
    return "tls";
  }
  if (code === "ECONNRESET" || code === "EPIPE" || code === "UND_ERR_SOCKET") return "connection-reset";
  return "unknown";
}

// Host + path only, never query/hash — a VIK URL's query string could carry session/tracking
// values that must not end up in logs.
function getSafeFinalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

async function safeReadText(response: FetchResponse): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

// Bounded, tag-stripped, whitespace-collapsed preview for diagnostics only — never the full body,
// and only ever computed for a non-2xx response.
function sanitizeBodyPreview(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const sanitized = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized ? sanitized.slice(0, maximumBodyPreviewLength) : undefined;
}

export {
  assertVikpgUrl,
  createVikpgHttpClient,
  defaultUserAgent,
  VikpgFetchError,
  type FetchImplementation,
  type VikpgFetchErrorCode,
  type VikpgHttpClient,
  type VikpgHttpClientOptions,
  type VikpgNetworkErrorType,
};
