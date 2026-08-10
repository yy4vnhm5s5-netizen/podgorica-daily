import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readPage = () => readFile(new URL("./airport-flights-page.tsx", import.meta.url), "utf8");
const readCard = () => readFile(new URL("./airport-flights-card.tsx", import.meta.url), "utf8");

test("full flight cards render airline and status only through the displayable-fact guard", async () => {
  const source = await readPage();

  assert.match(source, /const airline = getDisplayableFlightFact\(flight\.airline\);/u);
  assert.match(source, /const status = getDisplayableFlightFact\(flight\.status\);/u);
  assert.match(
    source,
    /\{airline \? <FlightValue label=\{copy\.airline\} value=\{airline\} \/> : null\}/u,
  );
  assert.match(
    source,
    /\{status \? <FlightValue label=\{copy\.status\} value=\{status\} \/> : null\}/u,
  );
  assert.match(source, /value=\{flight\.flightNumber\}/u);
});

test("dashboard flight rows use the same displayable-airline guard", async () => {
  const source = await readCard();

  assert.match(source, /const airline = getDisplayableFlightFact\(flight\.airline\);/u);
  assert.match(source, /title=\{airline\}/u);
});

test("full page and dashboard preserve stale-empty flight context", async () => {
  const [page, card] = await Promise.all([readPage(), readCard()]);

  for (const source of [page, card]) {
    assert.match(source, /displayState === "stale-empty"/u);
    assert.match(source, /Nema narednih letova u posljednjem dostupnom redu letenja\./u);
    assert.match(source, /displayState === "stale" \|\| displayState === "stale-empty"/u);
  }

  assert.match(page, /description=\{copy\.staleEmpty\}/u);
  assert.match(card, /updatedLabel && displayState !== "unavailable"/u);
});
