import { vikpgOrigin } from "./vikpg-water-notices.ts";

interface VikpgHttpClient {
  get(url: string): Promise<string>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

interface VikpgHttpClientOptions {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
}

class VikpgFetchError extends Error {
  readonly code: "vikpg-host-rejected" | "vikpg-request-failed" | "vikpg-request-timeout";

  constructor(
    code: "vikpg-host-rejected" | "vikpg-request-failed" | "vikpg-request-timeout",
    message: string,
  ) {
    super(message);
    this.name = "VikpgFetchError";
    this.code = code;
  }
}

const defaultUserAgent =
  "PodgoricaDaily/0.1 (+https://github.com/yy4vnhm5s5-netizen/podgorica-daily)";

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
          if (response.ok) {
            const body = await response.text();
            if (body.trim()) return body;
            latestError = new VikpgFetchError("vikpg-request-failed", "VIK returned an empty page.");
          } else {
            latestError = new VikpgFetchError(
              "vikpg-request-failed",
              `VIK returned HTTP ${response.status}.`,
            );
            if (response.status !== 429 && response.status < 500) break;
          }
        } catch (error) {
          latestError = new VikpgFetchError(
            isAbortError(error) ? "vikpg-request-timeout" : "vikpg-request-failed",
            isAbortError(error) ? "VIK request timed out." : "VIK request failed.",
          );
        }
      }
      throw latestError ?? new VikpgFetchError("vikpg-request-failed", "VIK request failed.");
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

export {
  assertVikpgUrl,
  createVikpgHttpClient,
  defaultUserAgent,
  VikpgFetchError,
  type FetchImplementation,
  type VikpgHttpClient,
  type VikpgHttpClientOptions,
};
