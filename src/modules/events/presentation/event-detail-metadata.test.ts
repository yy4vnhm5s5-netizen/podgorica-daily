import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import {
  createEventDetailMetadataDescription,
  createEventDetailMetadataTitle,
  maximumEventDetailMetadataDescriptionLength,
  maximumEventDetailMetadataTitleLength,
} from "./event-detail-metadata.ts";
import { createEventStructuredData } from "./event-structured-data.ts";
import { createCityContext } from "@/shared/config/cities";

test("builds a concise event detail description from reliable event context and a short excerpt", () => {
  const description = createEventDetailMetadataDescription({
    cityLocative: "Podgorici",
    event: podgoricaEvent({
      description: "Veče savremene muzike sa gostujućim umjetnicima.",
      venueName: "KIC Budo Tomović",
    }),
    eventDay: "17. jul 2026.",
  });

  assert.equal(
    description,
    "Događaj Ljetnji koncert u KIC Budo Tomović u Podgorici, 17. jul 2026. Veče savremene muzike sa gostujućim umjetnicima.",
  );
});

test("normalizes source markup and whitespace before generating the metadata excerpt", () => {
  const description = createEventDetailMetadataDescription({
    cityLocative: "Tivtu",
    event: podgoricaEvent({
      description: "\n <p>Program&nbsp;sa <strong>više</strong> izvođača &amp; gostima.</p> \n",
      venueName: undefined,
    }),
  });

  assert.equal(description, "Događaj Ljetnji koncert u Tivtu. Program sa više izvođača & gostima.");
  assert.doesNotMatch(description, /<[^>]+>|&nbsp;|\n/u);
});

test("keeps a useful event-context description when optional source text or venue is absent", () => {
  const description = createEventDetailMetadataDescription({
    cityLocative: "Budvi",
    event: podgoricaEvent({ description: undefined, venueName: undefined }),
    eventDay: "18. jul 2026.",
  });

  assert.equal(description, "Događaj Ljetnji koncert u Budvi, 18. jul 2026.");
});

test("caps long source descriptions cleanly without emitting the complete source body", () => {
  const sourceDescription = `${"Detaljan opis programa sa svim informacijama za posjetioce ".repeat(12)}završetak`;
  const description = createEventDetailMetadataDescription({
    cityLocative: "Podgorici",
    event: podgoricaEvent({ description: sourceDescription }),
    eventDay: "17. jul 2026.",
  });

  assert.ok(description.length <= maximumEventDetailMetadataDescriptionLength);
  assert.match(description, /…$/u);
  assert.equal(description.includes(sourceDescription), false);
  const prefix = "Događaj Ljetnji koncert u KIC Budo Tomović u Podgorici, 17. jul 2026.";
  const excerpt = description.slice(prefix.length + 1, -1);
  assert.equal(sourceDescription.startsWith(excerpt), true);
  assert.equal(sourceDescription.at(excerpt.length), " ", "ellipsis follows a complete word");
});

test("keeps a normal event metadata title byte-for-byte consistent with the existing convention", () => {
  const title = createEventDetailMetadataTitle({
    city: createCityContext("podgorica").city,
    event: podgoricaEvent({ title: "Ljetnji koncert" }),
  });

  assert.equal(title, "Ljetnji koncert — Podgorica | Gradom.me");
});

test("bounds only an unusually long event title while preserving city and Gradom.me context", () => {
  const rawTitle = "Završni koncerti XV Ljetnjeg kampa za kamernu muziku";
  const title = createEventDetailMetadataTitle({
    city: createCityContext("podgorica").city,
    event: podgoricaEvent({ title: rawTitle }),
  });
  const suffix = " — Podgorica | Gradom.me";
  const shortenedEventTitle = title.slice(0, -suffix.length);
  const visibleWords = shortenedEventTitle.slice(0, -1);

  assert.ok(title.length <= maximumEventDetailMetadataTitleLength);
  assert.match(title, /… — Podgorica \| Gradom\.me$/u);
  assert.equal(title.includes(rawTitle), false);
  assert.equal(rawTitle.startsWith(visibleWords), true);
  assert.equal(rawTitle.at(visibleWords.length), " ", "ellipsis follows a complete word");
});

test("does not shorten the visible event title or Event JSON-LD name", () => {
  const rawTitle = "Izložba MOZAIK CRNOGORSKE PRIRODE, Prirodnjački muzej Crne Gore";
  const event = podgoricaEvent({ title: rawTitle });

  assert.equal(createEventStructuredData(event)?.name, rawTitle);
});
