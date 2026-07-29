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
  assert.equal(urls.includes("/"), true);
  assert.equal(urls.includes("/budva"), true);
  assert.equal(urls.includes("/budva/izlasci"), true);
  assert.equal(urls.includes("/budva/struja"), true);
  assert.equal(urls.includes("/o-platformi"), true);
  assert.equal(
    urls.some((path) => path.startsWith("/api/")),
    false,
  );
  assert.equal(urls.includes("/budva/dogadjaji"), false);
  assert.equal(urls.includes("/budva/filmovi"), false);
  assert.equal(urls.includes("/budva/letovi"), false);
  assert.equal(urls.includes("/tivat"), true);
  assert.equal(urls.includes("/tivat/dogadjaji"), true);
  assert.equal(urls.includes("/tivat/izlasci"), true);
  assert.equal(urls.includes("/tivat/struja"), true);
  assert.equal(urls.includes("/tivat/plaze"), true);
  // Tivat has the generic "events" capability (Tourism Tivat provider) but not Cineplexx, which
  // is Podgorica-only — it must not get a /filmovi sitemap entry that can only ever 404 or show
  // "no movies". See isCityCinemaRouteAvailable in city-routing.ts.
  assert.equal(urls.includes("/tivat/filmovi"), false);
  assert.equal(urls.includes("/tivat/letovi"), false);
});
