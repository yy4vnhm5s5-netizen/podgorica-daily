interface GlavniGradHttpClient {
  get(url: string): Promise<string>;
}

class GlavniGradFetchError extends Error {
  readonly code:
    "glavni-grad-host-rejected" | "glavni-grad-request-failed" | "glavni-grad-request-timeout";

  constructor(code: GlavniGradFetchError["code"], message: string) {
    super(message);
    this.name = "GlavniGradFetchError";
    this.code = code;
  }
}

function createGlavniGradHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
}: {
  fetchImplementation?: typeof fetch;
  retries?: number;
  timeoutMs?: number;
} = {}): GlavniGradHttpClient {
  return {
    async get(url) {
      assertGlavniGradUrl(url);
      let failure: GlavniGradFetchError | undefined;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            headers: {
              "User-Agent": "Gradom/0.1 (+https://gradom.me)",
            },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.ok) return response.text();
          failure = new GlavniGradFetchError(
            "glavni-grad-request-failed",
            "Glavni Grad request failed.",
          );
        } catch (error) {
          failure = new GlavniGradFetchError(
            error instanceof Error && error.name === "AbortError"
              ? "glavni-grad-request-timeout"
              : "glavni-grad-request-failed",
            "Glavni Grad request failed.",
          );
        }
      }
      throw (
        failure ??
        new GlavniGradFetchError("glavni-grad-request-failed", "Glavni Grad request failed.")
      );
    },
  };
}

function assertGlavniGradUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "podgorica.me") throw new Error();
  } catch {
    throw new GlavniGradFetchError(
      "glavni-grad-host-rejected",
      "Glavni Grad URL host is not allowed.",
    );
  }
}

export {
  assertGlavniGradUrl,
  createGlavniGradHttpClient,
  GlavniGradFetchError,
  type GlavniGradHttpClient,
};
