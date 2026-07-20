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
  const renderer = createCineplexxBrowserRenderer({
    browserPath: "/usr/bin/chromium-browser",
    execute: async (file, args) => {
      received = { args, file };
      return { stderr: "", stdout: renderedProgramme };
    },
  });

  assert.equal(await renderer.renderProgramme(), renderedProgramme);
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
    file: "/usr/bin/chromium-browser",
  });
});

test("rejects off-domain source URLs and incomplete rendered programmes", async () => {
  assert.throws(
    () => assertCineplexxProgrammeUrl("https://example.test/programme"),
    CineplexxBrowserError,
  );
  const renderer = createCineplexxBrowserRenderer({
    execute: async () => ({ stderr: "", stdout: "<main>Loading</main>" }),
  });
  await assert.rejects(() => renderer.renderProgramme(), CineplexxBrowserError);
});

test("maps browser timeouts to typed Cineplexx failures", async () => {
  const renderer = createCineplexxBrowserRenderer({
    execute: async () => {
      throw new Error("Command timed out");
    },
  });
  await assert.rejects(
    () => renderer.renderProgramme(),
    (error: unknown) =>
      error instanceof CineplexxBrowserError && error.code === "cineplexx-browser-timeout",
  );
});
