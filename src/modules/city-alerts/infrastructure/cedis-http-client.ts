import { cedisOrigin } from "./cedis-planned-outages.ts";

interface CedisHttpClient {
  get(url: string): Promise<string>;
  getDocument?(url: string): Promise<CedisHttpDocument>;
}

interface CedisHttpDocument {
  contentType?: string;
  finalUrl: string;
  html: string;
  status: number;
}

interface CedisHttpClientOptions {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
}

interface FetchResponse {
  headers?: {
    get(name: string): string | null;
  };
  ok: boolean;
  status: number;
  text(): Promise<string>;
  url?: string;
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
  async function getDocument(url: string): Promise<CedisHttpDocument> {
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

        const contentType = response.headers?.get("content-type") ?? undefined;
        const finalUrl = response.url || url;
        assertCedisUrl(finalUrl);
        return {
          ...(contentType ? { contentType } : {}),
          finalUrl,
          html: await response.text(),
          status: response.status,
        };
      } catch (error) {
        latestError = new CedisFetchError(
          isAbortError(error) ? "cedis-request-timeout" : "cedis-request-failed",
          isAbortError(error) ? "CEDIS request timed out." : "CEDIS request failed.",
        );
      }
    }

    throw latestError ?? new CedisFetchError("cedis-request-failed", "CEDIS request failed.");
  }

  return {
    async get(url: string) {
      return (await getDocument(url)).html;
    },
    getDocument,
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
  type CedisHttpDocument,
  type CedisHttpClientOptions,
  type FetchImplementation,
  type FetchResponse,
};
