interface TourismHttpClient {
  get(url: string): Promise<string>;
}
interface TourismResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  text(): Promise<string>;
}
type TourismFetch = (url: string, init: RequestInit) => Promise<TourismResponse>;
class TourismFetchError extends Error {
  readonly code:
    | "tourism-host-rejected"
    | "tourism-request-failed"
    | "tourism-request-timeout"
    | "tourism-response-invalid";

  constructor(code: TourismFetchError["code"], message: string) {
    super(message);
    this.name = "TourismFetchError";
    this.code = code;
  }
}
function assertTourismUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["podgorica.travel", "www.podgorica.travel"].includes(url.hostname)
    )
      throw new Error();
  } catch {
    throw new TourismFetchError("tourism-host-rejected", "Tourism URL host is not allowed.");
  }
}
function createTourismHttpClient({
  fetchImplementation = fetch as unknown as TourismFetch,
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: TourismFetch;
  retries?: number;
  timeoutMs?: number;
} = {}): TourismHttpClient {
  return {
    async get(url) {
      assertTourismUrl(url);
      let error: TourismFetchError | undefined;
      for (let attempt = 0; attempt <= retries; attempt += 1)
        try {
          const response = await fetchImplementation(url, {
            headers: {
              "User-Agent":
                "PodgoricaDaily/0.1 (+https://github.com/yy4vnhm5s5-netizen/podgorica-daily)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!response.ok) {
            if (response.status < 429 || (response.status > 429 && response.status < 500))
              return Promise.reject(
                new TourismFetchError(
                  "tourism-response-invalid",
                  `Tourism returned HTTP ${response.status}.`,
                ),
              );
            error = new TourismFetchError("tourism-request-failed", "Tourism request failed.");
            continue;
          }
          if (!response.headers.get("content-type")?.includes("text/html"))
            throw new TourismFetchError(
              "tourism-response-invalid",
              "Tourism response was not HTML.",
            );
          const body = await response.text();
          if (!body.trim())
            throw new TourismFetchError("tourism-response-invalid", "Tourism response was empty.");
          return body;
        } catch (caught) {
          if (
            caught instanceof TourismFetchError &&
            ["tourism-host-rejected", "tourism-response-invalid"].includes(caught.code)
          )
            throw caught;
          error =
            caught instanceof TourismFetchError
              ? caught
              : new TourismFetchError(
                  caught instanceof Error && caught.name === "AbortError"
                    ? "tourism-request-timeout"
                    : "tourism-request-failed",
                  "Tourism request failed.",
                );
        }
      throw error ?? new TourismFetchError("tourism-request-failed", "Tourism request failed.");
    },
  };
}
export { assertTourismUrl, createTourismHttpClient, TourismFetchError, type TourismHttpClient };
