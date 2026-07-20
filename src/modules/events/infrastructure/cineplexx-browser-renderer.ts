import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { cineplexxProgrammeUrl } from "./cineplexx-programme-parser.ts";

const executeFile = promisify(execFile);
const allowedCineplexxHosts = new Set(["cineplexx.me", "www.cineplexx.me"]);
const chromiumCommands = ["chromium-browser", "chromium", "google-chrome", "google-chrome-stable"];

type CineplexxBrowserFailurePhase =
  "chromium-launch" | "dom-dump" | "page-load" | "source-validation";

interface CineplexxDomDiagnostics {
  expectedBookingSelectorExists: boolean;
  expectedSessionSelectorExists: boolean;
  finalUrl: string;
  htmlLength: number;
  title: string;
}

class CineplexxBrowserError extends Error {
  readonly code:
    | "cineplexx-browser-failed"
    | "cineplexx-browser-invalid-output"
    | "cineplexx-browser-timeout"
    | "cineplexx-source-rejected";
  readonly causeClass?: string;
  readonly causeMessage?: string;
  readonly domDiagnostics?: CineplexxDomDiagnostics;
  readonly executableMissing: boolean;
  readonly phase: CineplexxBrowserFailurePhase;

  constructor(
    code: CineplexxBrowserError["code"],
    message: string,
    {
      cause,
      domDiagnostics,
      executableMissing = false,
      phase,
    }: {
      cause?: unknown;
      domDiagnostics?: CineplexxDomDiagnostics;
      executableMissing?: boolean;
      phase: CineplexxBrowserFailurePhase;
    },
  ) {
    super(message);
    this.name = "CineplexxBrowserError";
    this.code = code;
    this.causeClass = cause instanceof Error ? cause.name : undefined;
    this.causeMessage = cause instanceof Error ? cause.message : undefined;
    this.domDiagnostics = domDiagnostics;
    this.executableMissing = executableMissing;
    this.phase = phase;
  }
}

interface CineplexxBrowserRenderer {
  renderProgramme(url?: string): Promise<string>;
}

interface CineplexxBrowserRendererOptions {
  chromiumPath?: string;
  execute?: CineplexxProcessExecutor;
  resolveExecutable?: CineplexxExecutableResolver;
  timeoutMs?: number;
}

interface CineplexxExecutableResolver {
  (candidates: readonly string[]): Promise<string | undefined>;
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

const nodeExecutableResolver: CineplexxExecutableResolver = async (candidates) => {
  for (const candidate of candidates) {
    try {
      const { stdout } = await executeFile("which", [candidate], {
        encoding: "utf8",
        maxBuffer: 8 * 1024,
        timeout: 2_000,
      });
      const executable = String(stdout).trim().split(/\r?\n/)[0];
      if (executable) return executable;
    } catch {
      // Try the next approved Chromium command.
    }
  }
  return undefined;
};

function createCineplexxBrowserRenderer({
  chromiumPath,
  execute = nodeProcessExecutor,
  resolveExecutable = nodeExecutableResolver,
  timeoutMs = 30_000,
}: CineplexxBrowserRendererOptions = {}): CineplexxBrowserRenderer {
  return {
    async renderProgramme(url = cineplexxProgrammeUrl) {
      assertCineplexxProgrammeUrl(url);
      const candidates = getChromiumCandidates(chromiumPath);
      const browserPath = await resolveExecutable(candidates);
      if (!browserPath)
        throw new CineplexxBrowserError(
          "cineplexx-browser-failed",
          `Chromium executable was not found. Checked: ${candidates.join(", ")}.`,
          { executableMissing: true, phase: "chromium-launch" },
        );
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
            {
              domDiagnostics: inspectCineplexxRenderedDom(stdout, url),
              phase: "dom-dump",
            },
          );
        if (!/l-sessions__item/.test(stdout) || !/\/purchase\/wizard\//.test(stdout))
          throw new CineplexxBrowserError(
            "cineplexx-browser-invalid-output",
            "Cineplexx programme did not finish rendering.",
            {
              domDiagnostics: inspectCineplexxRenderedDom(stdout, url),
              phase: "dom-dump",
            },
          );
        return stdout;
      } catch (error) {
        if (error instanceof CineplexxBrowserError) throw error;
        const message =
          error instanceof Error ? error.message : "Unknown browser renderer failure.";
        const executableMissing = isExecutableMissing(error);
        const code = /timed out|ETIMEDOUT/i.test(message)
          ? "cineplexx-browser-timeout"
          : "cineplexx-browser-failed";
        throw new CineplexxBrowserError(code, "Cineplexx browser renderer failed.", {
          cause: error,
          executableMissing,
          phase: executableMissing ? "chromium-launch" : "page-load",
        });
      }
    },
  };
}

function getChromiumCandidates(chromiumPath: string | undefined) {
  return [...new Set([chromiumPath?.trim(), ...chromiumCommands].filter(isNonEmptyString))];
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function assertCineplexxProgrammeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedCineplexxHosts.has(url.hostname)) throw new Error();
  } catch {
    throw new CineplexxBrowserError(
      "cineplexx-source-rejected",
      "Cineplexx programme URL is not allowed.",
      { phase: "source-validation" },
    );
  }
}

function inspectCineplexxRenderedDom(html: string, requestedUrl: string): CineplexxDomDiagnostics {
  const title =
    html
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  return {
    expectedBookingSelectorExists: /\/purchase\/wizard\//.test(html),
    expectedSessionSelectorExists: /l-sessions__item/.test(html),
    finalUrl: resolveCineplexxDiagnosticUrl(canonical, requestedUrl),
    htmlLength: html.length,
    title,
  };
}

function resolveCineplexxDiagnosticUrl(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    return new URL(value, fallback).toString();
  } catch {
    return fallback;
  }
}

function isExecutableMissing(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : undefined;
  const message = error instanceof Error ? error.message : "";
  return code === "ENOENT" || /ENOENT|not found|no such file/i.test(message);
}

export {
  assertCineplexxProgrammeUrl,
  createCineplexxBrowserRenderer,
  CineplexxBrowserError,
  inspectCineplexxRenderedDom,
  type CineplexxBrowserRenderer,
  type CineplexxBrowserRendererOptions,
  type CineplexxExecutableResolver,
  type CineplexxBrowserFailurePhase,
  type CineplexxDomDiagnostics,
  type CineplexxProcessExecutor,
};
