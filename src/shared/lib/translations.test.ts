import assert from "node:assert/strict";
import test from "node:test";

import { getTranslations } from "./translations.ts";

test("localizes the cinema placeholder without introducing mock screening data", () => {
  const translations = getTranslations("me").dashboard.cards;

  assert.equal(translations.cinema, "U bioskopu");
  assert.equal(translations.cinemaDescription, "Program bioskopa trenutno nije dostupan.");
  assert.equal(translations.cinemaAction, "Pogledajte projekcije →");
});

test("localizes cinema and emergency-number labels in English", () => {
  const { cards, emergencyNumbers } = getTranslations("en").dashboard;

  assert.equal(cards.cinema, "In cinemas");
  assert.equal(cards.cinemaDescription, "Cinema listings are currently unavailable.");
  assert.equal(cards.cinemaAction, "View screenings →");
  assert.deepEqual(emergencyNumbers, {
    ambulance: "Ambulance",
    fireService: "Fire service",
    label: "Emergency numbers",
    police: "Police",
  });
});
