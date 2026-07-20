interface AmscgHttpClient {
  get(url: string): Promise<string>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

interface AmscgHttpClientOptions {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
}

class AmscgFetchError extends Error {
  readonly code: "amscg-host-rejected" | "amscg-request-failed" | "amscg-request-timeout";

  constructor(
    code: "amscg-host-rejected" | "amscg-request-failed" | "amscg-request-timeout",
    message: string,
  ) {
    super(message);
    this.name = "AmscgFetchError";
    this.code = code;
  }
}

const amscgRoadConditionsUrl = "https://amscg.org/stanje-na-putevima/";
const defaultUserAgent = "Gradom/0.1 (+https://gradom.me)";

function createAmscgHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
  userAgent = defaultUserAgent,
}: AmscgHttpClientOptions = {}): AmscgHttpClient {
  return {
    async get(url: string) {
      assertAmscgUrl(url);
      let latestError: AmscgFetchError | undefined;
      for (let attempt = 0; attempt <= Math.max(0, retries); attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.ok) return await response.text();
          latestError = new AmscgFetchError(
            "amscg-request-failed",
            `AMSCG returned HTTP ${response.status}.`,
          );
        } catch (error) {
          latestError = new AmscgFetchError(
            isAbortError(error) ? "amscg-request-timeout" : "amscg-request-failed",
            isAbortError(error) ? "AMSCG request timed out." : "AMSCG request failed.",
          );
        }
      }
      throw latestError ?? new AmscgFetchError("amscg-request-failed", "AMSCG request failed.");
    },
  };
}

function assertAmscgUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "amscg.org") throw new Error();
  } catch {
    throw new AmscgFetchError("amscg-host-rejected", "AMSCG URL host is not allowed.");
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export {
  amscgRoadConditionsUrl,
  assertAmscgUrl,
  createAmscgHttpClient,
  AmscgFetchError,
  type AmscgHttpClient,
  type AmscgHttpClientOptions,
  type FetchImplementation,
};
