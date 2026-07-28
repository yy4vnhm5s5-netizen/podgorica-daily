const morskodobroOrigin = "https://monitoring.morskodobro.me";

interface MorskodobroHttpClient {
  post(url: string, body: URLSearchParams): Promise<string>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchImplementation = (url: string, init: RequestInit) => Promise<FetchResponse>;

interface MorskodobroHttpClientOptions {
  fetchImplementation?: FetchImplementation;
  retries?: number;
  timeoutMs?: number;
  userAgent?: string;
}

class MorskodobroFetchError extends Error {
  readonly code: "morskodobro-host-rejected" | "morskodobro-request-failed" | "morskodobro-request-timeout";

  constructor(
    code: "morskodobro-host-rejected" | "morskodobro-request-failed" | "morskodobro-request-timeout",
    message: string,
  ) {
    super(message);
    this.name = "MorskodobroFetchError";
    this.code = code;
  }
}

const defaultUserAgent = "Gradom/0.1 (+https://gradom.me)";

function createMorskodobroHttpClient({
  fetchImplementation = fetch,
  retries = 1,
  timeoutMs = 10_000,
  userAgent = defaultUserAgent,
}: MorskodobroHttpClientOptions = {}): MorskodobroHttpClient {
  return {
    async post(url: string, body: URLSearchParams) {
      assertMorskodobroUrl(url);
      const attempts = Math.max(0, retries) + 1;
      let latestError: MorskodobroFetchError | undefined;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImplementation(url, {
            body: body.toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "User-Agent": userAgent,
              "X-Requested-With": "XMLHttpRequest",
            },
            method: "POST",
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.ok) {
            const text = await response.text();
            if (text.trim()) return text;
            latestError = new MorskodobroFetchError(
              "morskodobro-request-failed",
              "Morsko dobro returned an empty response.",
            );
          } else {
            latestError = new MorskodobroFetchError(
              "morskodobro-request-failed",
              `Morsko dobro returned HTTP ${response.status}.`,
            );
            if (response.status !== 429 && response.status < 500) break;
          }
        } catch (error) {
          latestError = new MorskodobroFetchError(
            isAbortError(error) ? "morskodobro-request-timeout" : "morskodobro-request-failed",
            isAbortError(error) ? "Morsko dobro request timed out." : "Morsko dobro request failed.",
          );
        }
      }
      throw latestError ?? new MorskodobroFetchError("morskodobro-request-failed", "Morsko dobro request failed.");
    },
  };
}

function assertMorskodobroUrl(value: string) {
  try {
    const url = new URL(value);
    const origin = new URL(morskodobroOrigin);
    if (url.protocol !== "https:" || url.hostname !== origin.hostname) {
      throw new Error();
    }
  } catch {
    throw new MorskodobroFetchError("morskodobro-host-rejected", "Morsko dobro URL host is not allowed.");
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export {
  assertMorskodobroUrl,
  createMorskodobroHttpClient,
  defaultUserAgent,
  morskodobroOrigin,
  MorskodobroFetchError,
  type FetchImplementation,
  type MorskodobroHttpClient,
  type MorskodobroHttpClientOptions,
};
