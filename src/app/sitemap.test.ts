import assert from "node:assert/strict";
import test from "node:test";

import sitemap from "./sitemap.ts";

test("publishes only canonical indexable public routes", async () => {
  const urls = (await sitemap()).map(({ url }) => new URL(url).pathname);

  assert.deepEqual(
    [
      "/podgorica",
      "/podgorica/dogadjaji",
      "/podgorica/izlasci",
      "/podgorica/filmovi",
      "/podgorica/letovi",
      "/podgorica/struja",
    ].every((path) => urls.includes(path)),
    true,
  );
  assert.equal(urls.includes("/"), false);
  assert.equal(
    urls.some((path) => path.startsWith("/api/")),
    false,
  );
  assert.equal(
    urls.some((path) => path.startsWith("/budva")),
    false,
  );
});
