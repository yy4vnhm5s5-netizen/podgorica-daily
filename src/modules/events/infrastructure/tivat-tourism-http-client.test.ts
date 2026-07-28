import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTivatTourismUrl,
  createTivatTourismHttpClient,
  TivatTourismFetchError,
} from "./tivat-tourism-http-client.ts";
const response = (status = 200, body = "<html>ok</html>", type = "text/html") => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ "content-type": type }),
  text: async () => body,
});
test("allows official listing and www hosts", async () => {
  const client = createTivatTourismHttpClient({ fetchImplementation: async () => response() });
  assert.equal(await client.get("https://tivat.travel/dogadjaji/"), "<html>ok</html>");
  assert.equal(await client.get("https://www.tivat.travel/dogadjaji/"), "<html>ok</html>");
});
test("rejects unsupported hosts and protocols", () => {
  assert.throws(() => assertTivatTourismUrl("http://tivat.travel/x"), TivatTourismFetchError);
  assert.throws(() => assertTivatTourismUrl("https://evil.test/x"), TivatTourismFetchError);
});
test("retries transient failures but not permanent responses", async () => {
  let attempts = 0;
  const client = createTivatTourismHttpClient({
    fetchImplementation: async () => {
      attempts++;
      return response(attempts === 1 ? 429 : 200);
    },
  });
  await client.get("https://tivat.travel/x");
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(
    createTivatTourismHttpClient({
      fetchImplementation: async () => {
        attempts++;
        return response(404);
      },
    }).get("https://tivat.travel/x"),
    TivatTourismFetchError,
  );
  assert.equal(attempts, 1);
});
test("rejects empty or non-html responses and exhausts network retries", async () => {
  await assert.rejects(
    createTivatTourismHttpClient({
      fetchImplementation: async () => response(200, "", "text/html"),
    }).get("https://tivat.travel/x"),
    TivatTourismFetchError,
  );
  await assert.rejects(
    createTivatTourismHttpClient({
      fetchImplementation: async () => response(200, "ok", "application/json"),
    }).get("https://tivat.travel/x"),
    TivatTourismFetchError,
  );
  let attempts = 0;
  await assert.rejects(
    createTivatTourismHttpClient({
      fetchImplementation: async () => {
        attempts++;
        throw new Error("network");
      },
    }).get("https://tivat.travel/x"),
    TivatTourismFetchError,
  );
  assert.equal(attempts, 2);
});
