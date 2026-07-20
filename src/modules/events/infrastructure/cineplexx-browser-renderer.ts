import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { cineplexxProgrammeUrl } from "./cineplexx-programme-parser.ts";

const executeFile = promisify(execFile);
const allowedCineplexxHosts = new Set(["cineplexx.me", "www.cineplexx.me"]);

class CineplexxBrowserError extends Error {
  readonly code:
    | "cineplexx-browser-failed"
    | "cineplexx-browser-invalid-output"
    | "cineplexx-browser-timeout"
    | "cineplexx-source-rejected";

  constructor(code: CineplexxBrowserError["code"], message: string) {
    super(message);
    this.name = "CineplexxBrowserError";
    this.code = code;
  }
}

interface CineplexxBrowserRenderer {
  renderProgramme(url?: string): Promise<string>;
}

interface CineplexxBrowserRendererOptions {
  browserPath?: string;
  execute?: CineplexxProcessExecutor;
  timeoutMs?: number;
}

interface CineplexxProcessExecutor {
  (
    file: string,
    arguments_: readonly string[],
    options: { encoding: "utf8"; maxBuffer: number; timeout: number },
  ): Promise<{ stderr: string; stdout: string }>;
}

const nodeProcessExecutor: CineplexxProcessExecutor = async (file, arguments_, options) => {
  const { stderr, stdout } = await executeFile(file, arguments_, options);
  return { stderr: String(stderr), stdout: String(stdout) };
};

function createCineplexxBrowserRenderer({
  browserPath = "/usr/bin/chromium-browser",
  execute = nodeProcessExecutor,
  timeoutMs = 30_000,
}: CineplexxBrowserRendererOptions = {}): CineplexxBrowserRenderer {
  return {
    async renderProgramme(url = cineplexxProgrammeUrl) {
      assertCineplexxProgrammeUrl(url);
      try {
        const { stdout } = await execute(
          browserPath,
          [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--headless=new",
            "--no-sandbox",
            "--no-zygote",
            "--virtual-time-budget=12000",
            "--dump-dom",
            url,
          ],
          { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs },
        );
        if (!stdout.trim())
          throw new CineplexxBrowserError(
            "cineplexx-browser-invalid-output",
            "Cineplexx browser renderer returned an empty document.",
          );
        if (!/l-sessions__item/.test(stdout) || !/\/purchase\/wizard\//.test(stdout))
          throw new CineplexxBrowserError(
            "cineplexx-browser-invalid-output",
            "Cineplexx programme did not finish rendering.",
          );
        return stdout;
      } catch (error) {
        if (error instanceof CineplexxBrowserError) throw error;
        const message = error instanceof Error ? error.message : "Unknown browser renderer failure.";
        const code = /timed out|ETIMEDOUT/i.test(message)
          ? "cineplexx-browser-timeout"
          : "cineplexx-browser-failed";
        throw new CineplexxBrowserError(code, "Cineplexx browser renderer failed.");
      }
    },
  };
}

function assertCineplexxProgrammeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedCineplexxHosts.has(url.hostname)) throw new Error();
  } catch {
    throw new CineplexxBrowserError(
      "cineplexx-source-rejected",
      "Cineplexx programme URL is not allowed.",
    );
  }
}

export {
  assertCineplexxProgrammeUrl,
  createCineplexxBrowserRenderer,
  CineplexxBrowserError,
  type CineplexxBrowserRenderer,
  type CineplexxBrowserRendererOptions,
  type CineplexxProcessExecutor,
};
