interface TivatTourismHttpClient {
  get(url: string): Promise<string>;
}
interface TivatTourismResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  text(): Promise<string>;
}
type TivatTourismFetch = (url: string, init: RequestInit) => Promise<TivatTourismResponse>;
class TivatTourismFetchError extends Error {
  readonly code:
    | "tivat-tourism-host-rejected"
    | "tivat-tourism-request-failed"
    | "tivat-tourism-request-timeout"
    | "tivat-tourism-response-invalid";

  constructor(code: TivatTourismFetchError["code"], message: string) {
    super(message);
    this.name = "TivatTourismFetchError";
    this.code = code;
  }
}
function assertTivatTourismUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["tivat.travel", "www.tivat.travel"].includes(url.hostname))
      throw new Error();
  } catch {
    throw new TivatTourismFetchError(
      "tivat-tourism-host-rejected",
      "Tivat Tourism URL host is not allowed.",
    );
  }
}
function createTivatTourismHttpClient({
  fetchImplementation = fetch as unknown as TivatTourismFetch,
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: TivatTourismFetch;
  retries?: number;
  timeoutMs?: number;
} = {}): TivatTourismHttpClient {
  return {
    async get(url) {
      assertTivatTourismUrl(url);
      let error: TivatTourismFetchError | undefined;
      for (let attempt = 0; attempt <= retries; attempt += 1)
        try {
          const response = await fetchImplementation(url, {
            headers: {
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!response.ok) {
            if (response.status < 429 || (response.status > 429 && response.status < 500))
              return Promise.reject(
                new TivatTourismFetchError(
                  "tivat-tourism-response-invalid",
                  `Tivat Tourism returned HTTP ${response.status}.`,
                ),
              );
            error = new TivatTourismFetchError(
              "tivat-tourism-request-failed",
              "Tivat Tourism request failed.",
            );
            continue;
          }
          if (!response.headers.get("content-type")?.includes("text/html"))
            throw new TivatTourismFetchError(
              "tivat-tourism-response-invalid",
              "Tivat Tourism response was not HTML.",
            );
          const body = await response.text();
          if (!body.trim())
            throw new TivatTourismFetchError(
              "tivat-tourism-response-invalid",
              "Tivat Tourism response was empty.",
            );
          return body;
        } catch (caught) {
          if (
            caught instanceof TivatTourismFetchError &&
            ["tivat-tourism-host-rejected", "tivat-tourism-response-invalid"].includes(caught.code)
          )
            throw caught;
          error =
            caught instanceof TivatTourismFetchError
              ? caught
              : new TivatTourismFetchError(
                  caught instanceof Error && caught.name === "AbortError"
                    ? "tivat-tourism-request-timeout"
                    : "tivat-tourism-request-failed",
                  "Tivat Tourism request failed.",
                );
        }
      throw error ?? new TivatTourismFetchError("tivat-tourism-request-failed", "Tivat Tourism request failed.");
    },
  };
}
export {
  assertTivatTourismUrl,
  createTivatTourismHttpClient,
  TivatTourismFetchError,
  type TivatTourismHttpClient,
};
