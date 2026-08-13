import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cardSource = () =>
  readFile(new URL("./parking-availability-card.tsx", import.meta.url), "utf8");

test("renders a compact Parking dashboard card from the public read model", async () => {
  const source = await cardSource();

  assert.match(source, /<h2[^>]*>Parking<\/h2>/u);
  assert.match(source, /Slobodna mjesta/u);
  assert.match(source, /getParkingDashboardSummary\(result\.locations\)/u);
  assert.match(source, /\{location\.name\}/u);
  assert.match(source, /\{location\.freeSpaces\}/u);
  assert.match(source, /\{summary\.summaryLabel\}/u);
  assert.match(source, /href=\{getParkingPath\(city\)\}/u);
  assert.match(source, /Sva parkirališta/u);
});

test("keeps the unavailable dashboard card navigable without exposing a historical count", async () => {
  const source = await cardSource();
  const modelSource = await readFile(new URL("./parking-ui-model.ts", import.meta.url), "utf8");

  assert.match(source, /Trenutno nema dostupnih ažuriranih podataka\./u);
  assert.doesNotMatch(source, /sourceUpdatedAt|Posljednje prijavljeno|Izvorni podatak/u);
  assert.doesNotMatch(source, /fetch\(|parkingservispg\.me/u);
  assert.doesNotMatch(
    modelSource,
    /getParkingLocationAvailabilityState|PARKING_AVAILABILITY_FRESHNESS/u,
  );
});
