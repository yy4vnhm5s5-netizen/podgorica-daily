import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTourismUrl,
  createTourismHttpClient,
  TourismFetchError,
} from "./tourism-http-client.ts";
const response = (status = 200, body = "<html>ok</html>", type = "text/html") => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ "content-type": type }),
  text: async () => body,
});
test("allows official listing and www detail hosts", async () => {
  const client = createTourismHttpClient({ fetchImplementation: async () => response() });
  assert.equal(await client.get("https://podgorica.travel/dogadjaji-kalendar/"), "<html>ok</html>");
  assert.equal(await client.get("https://www.podgorica.travel/event/"), "<html>ok</html>");
});
test("rejects unsupported hosts and protocols", () => {
  assert.throws(() => assertTourismUrl("http://podgorica.travel/x"), TourismFetchError);
  assert.throws(() => assertTourismUrl("https://evil.test/x"), TourismFetchError);
});
test("retries transient failures but not permanent responses", async () => {
  let attempts = 0;
  const client = createTourismHttpClient({
    fetchImplementation: async () => {
      attempts++;
      return response(attempts === 1 ? 429 : 200);
    },
  });
  await client.get("https://podgorica.travel/x");
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(
    createTourismHttpClient({
      fetchImplementation: async () => {
        attempts++;
        return response(404);
      },
    }).get("https://podgorica.travel/x"),
    TourismFetchError,
  );
  assert.equal(attempts, 1);
});
test("rejects empty or non-html responses and exhausts network retries", async () => {
  await assert.rejects(
    createTourismHttpClient({
      fetchImplementation: async () => response(200, "", "text/html"),
    }).get("https://podgorica.travel/x"),
    TourismFetchError,
  );
  await assert.rejects(
    createTourismHttpClient({
      fetchImplementation: async () => response(200, "ok", "application/json"),
    }).get("https://podgorica.travel/x"),
    TourismFetchError,
  );
  let attempts = 0;
  await assert.rejects(
    createTourismHttpClient({
      fetchImplementation: async () => {
        attempts++;
        throw new Error("network");
      },
    }).get("https://podgorica.travel/x"),
    TourismFetchError,
  );
  assert.equal(attempts, 2);
});
