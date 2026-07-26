import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("global pages use the platform homepage instead of the main city as their home link", async () => {
  const [contact, legal, about] = await Promise.all([
    readFile(new URL("../modules/contact/presentation/contact-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../modules/legal/presentation/legal-page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../modules/about/presentation/about-platform-page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  for (const source of [contact, legal, about]) {
    assert.match(source, /<DashboardLayout city=\{city\} homeHref="\/"/u);
  }
});
