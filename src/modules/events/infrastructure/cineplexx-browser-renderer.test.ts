import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCineplexxProgrammeUrl,
  createCineplexxBrowserRenderer,
  CineplexxBrowserError,
} from "./cineplexx-browser-renderer.ts";

const renderedProgramme = '<li class="l-sessions__item"><a href="/purchase/wizard/1"></a></li>';

test("renders the approved Cineplexx programme URL with bounded browser arguments", async () => {
  let received: unknown;
  let candidates: readonly string[] = [];
  const renderer = createCineplexxBrowserRenderer({
    chromiumPath: "/custom/chromium",
    execute: async (file, args) => {
      received = { args, file };
      return { stderr: "", stdout: renderedProgramme };
    },
    resolveExecutable: async (values) => {
      candidates = values;
      return "/custom/chromium";
    },
  });

  assert.equal(await renderer.renderProgramme(), renderedProgramme);
  assert.deepEqual(candidates, [
    "/custom/chromium",
    "chromium-browser",
    "chromium",
    "google-chrome",
    "google-chrome-stable",
  ]);
  assert.deepEqual(received, {
    args: [
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--headless=new",
      "--no-sandbox",
      "--no-zygote",
      "--virtual-time-budget=12000",
      "--dump-dom",
      "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
    ],
    file: "/custom/chromium",
  });
});

test("rejects off-domain source URLs and incomplete rendered programmes", async () => {
  assert.throws(
    () => assertCineplexxProgrammeUrl("https://example.test/programme"),
    CineplexxBrowserError,
  );
  const renderer = createCineplexxBrowserRenderer({
    execute: async () => ({ stderr: "", stdout: "<main>Loading</main>" }),
    resolveExecutable: async () => "chromium",
  });
  await assert.rejects(
    () => renderer.renderProgramme(),
    (error: unknown) => {
      assert.ok(error instanceof CineplexxBrowserError);
      assert.equal(error.phase, "dom-dump");
      assert.deepEqual(error.domDiagnostics, {
        expectedBookingSelectorExists: false,
        expectedSessionSelectorExists: false,
        finalUrl: "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/",
        htmlLength: 20,
        title: "",
      });
      return true;
    },
  );
});

test("maps browser timeouts to typed Cineplexx failures", async () => {
  const renderer = createCineplexxBrowserRenderer({
    execute: async () => {
      throw new Error("Command timed out");
    },
    resolveExecutable: async () => "chromium",
  });
  await assert.rejects(
    () => renderer.renderProgramme(),
    (error: unknown) =>
      error instanceof CineplexxBrowserError && error.code === "cineplexx-browser-timeout",
  );
});

test("identifies a missing Chromium executable as a launch failure", async () => {
  const renderer = createCineplexxBrowserRenderer({
    chromiumPath: "/custom/missing-chromium",
    resolveExecutable: async () => undefined,
  });

  await assert.rejects(
    () => renderer.renderProgramme(),
    (error: unknown) => {
      assert.ok(error instanceof CineplexxBrowserError);
      assert.equal(error.executableMissing, true);
      assert.equal(error.phase, "chromium-launch");
      assert.equal(
        error.message,
        "Chromium executable was not found. Checked: /custom/missing-chromium, chromium-browser, chromium, google-chrome, google-chrome-stable.",
      );
      return true;
    },
  );
});
