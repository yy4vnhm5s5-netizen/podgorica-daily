interface CnpHttpClient {
  get(url: string): Promise<string>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

class CnpFetchError extends Error {
  readonly code: "cnp-host-rejected" | "cnp-request-failed" | "cnp-request-timeout";

  constructor(code: CnpFetchError["code"], message: string) {
    super(message);
    this.name = "CnpFetchError";
    this.code = code;
  }
}

function createCnpHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
  userAgent = "PodgoricaDaily/0.1 (+https://github.com/yy4vnhm5s5-netizen/podgorica-daily)",
}: {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
} = {}): CnpHttpClient {
  return {
    async get(url) {
      assertCnpUrl(url);
      let latestError: CnpFetchError | undefined;
      for (let attempt = 0; attempt <= Math.max(0, retries); attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.ok) return await response.text();
          latestError = new CnpFetchError(
            "cnp-request-failed",
            `CNP returned HTTP ${response.status}.`,
          );
        } catch (error) {
          latestError = new CnpFetchError(
            error instanceof Error && error.name === "AbortError"
              ? "cnp-request-timeout"
              : "cnp-request-failed",
            "CNP request failed.",
          );
        }
      }
      throw latestError ?? new CnpFetchError("cnp-request-failed", "CNP request failed.");
    },
  };
}

function assertCnpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "cnp.me") throw new Error();
  } catch {
    throw new CnpFetchError("cnp-host-rejected", "CNP URL host is not allowed.");
  }
}

export { assertCnpUrl, createCnpHttpClient, CnpFetchError, type CnpHttpClient };
