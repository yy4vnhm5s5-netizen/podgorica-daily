interface KicHttpClient {
  get(url: string): Promise<string>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

class KicFetchError extends Error {
  readonly code: "kic-host-rejected" | "kic-request-failed" | "kic-request-timeout";

  constructor(code: KicFetchError["code"], message: string) {
    super(message);
    this.name = "KicFetchError";
    this.code = code;
  }
}

const kicNewsUrl = "https://kic.podgorica.me/novosti";
const defaultUserAgent =
  "PodgoricaDaily/0.1 (+https://github.com/yy4vnhm5s5-netizen/podgorica-daily)";

function createKicHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
  userAgent = defaultUserAgent,
}: {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
} = {}): KicHttpClient {
  return {
    async get(url) {
      assertKicUrl(url);
      let latestError: KicFetchError | undefined;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.ok) return await response.text();
          latestError = new KicFetchError(
            "kic-request-failed",
            `KIC returned HTTP ${response.status}.`,
          );
        } catch (error) {
          latestError = new KicFetchError(
            error instanceof Error && error.name === "AbortError"
              ? "kic-request-timeout"
              : "kic-request-failed",
            "KIC request failed.",
          );
        }
      }
      throw latestError ?? new KicFetchError("kic-request-failed", "KIC request failed.");
    },
  };
}

function assertKicUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "kic.podgorica.me") throw new Error();
  } catch {
    throw new KicFetchError("kic-host-rejected", "KIC URL host is not allowed.");
  }
}

export { assertKicUrl, createKicHttpClient, kicNewsUrl, KicFetchError, type KicHttpClient };
