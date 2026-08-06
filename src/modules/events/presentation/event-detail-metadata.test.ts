import assert from "node:assert/strict";
import test from "node:test";

import { podgoricaEvent } from "../__fixtures__/events.ts";
import {
  createEventDetailMetadataDescription,
  maximumEventDetailMetadataDescriptionLength,
} from "./event-detail-metadata.ts";

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
