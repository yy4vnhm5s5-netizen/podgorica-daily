import { cedisOrigin } from "./cedis-planned-outages.ts";

interface CedisHttpClient {
  get(url: string): Promise<string>;
}

interface CedisHttpClientOptions {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

class CedisFetchError extends Error {
  readonly code: "cedis-host-rejected" | "cedis-request-failed" | "cedis-request-timeout";

  constructor(
    code: "cedis-host-rejected" | "cedis-request-failed" | "cedis-request-timeout",
    message: string,
  ) {
    super(message);
    this.name = "CedisFetchError";
    this.code = code;
  }
}

const defaultUserAgent = "Gradom/0.1 (+https://gradom.me)";

function createCedisHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
  userAgent = defaultUserAgent,
}: CedisHttpClientOptions = {}): CedisHttpClient {
  return {
    async get(url: string) {
      assertCedisUrl(url);
      const attempts = Math.max(0, retries) + 1;
      let latestError: CedisFetchError | undefined;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!response.ok) {
            latestError = new CedisFetchError(
              "cedis-request-failed",
              `CEDIS returned HTTP ${response.status}.`,
            );
            continue;
          }
          return await response.text();
        } catch (error) {
          latestError = new CedisFetchError(
            isAbortError(error) ? "cedis-request-timeout" : "cedis-request-failed",
            isAbortError(error) ? "CEDIS request timed out." : "CEDIS request failed.",
          );
        }
      }

      throw latestError ?? new CedisFetchError("cedis-request-failed", "CEDIS request failed.");
    },
  };
}

function assertCedisUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CedisFetchError("cedis-host-rejected", "CEDIS URL is invalid.");
  }
  const expected = new URL(cedisOrigin);
  if (url.protocol !== "https:" || url.hostname !== expected.hostname) {
    throw new CedisFetchError("cedis-host-rejected", "CEDIS URL host is not allowed.");
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export {
  assertCedisUrl,
  createCedisHttpClient,
  CedisFetchError,
  defaultUserAgent,
  type CedisHttpClient,
  type CedisHttpClientOptions,
  type FetchImplementation,
  type FetchResponse,
};
