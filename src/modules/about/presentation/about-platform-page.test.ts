import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getAboutPlatformPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import {
  aboutPlatformContent,
  createAboutPlatformStructuredData,
} from "./about-platform-content.ts";

test("provides the page heading and only currently public information categories", () => {
  assert.equal(aboutPlatformContent.heading, "O platformi Gradom.me");
  assert.deepEqual(
    aboutPlatformContent.sections.map(({ heading }) => heading),
    [
      "Lokalne informacije po gradu",
      "Šta možete pronaći",
      "Kako platforma radi",
      "Svježina i dostupnost podataka",
      "Nezavisnost i ispravke",
    ],
  );
  assert.match(aboutPlatformContent.sections[1].body[0] ?? "", /vrijeme/i);
  assert.match(aboutPlatformContent.sections[1].body[0] ?? "", /letove/i);
  assert.match(aboutPlatformContent.sections[1].body[0] ?? "", /bioskopski program/i);
  assert.match(aboutPlatformContent.metadataDescription, /Gradom\.me/i);
  assert.match(aboutPlatformContent.metadataDescription, /gradove Crne Gore/i);
  assert.doesNotMatch(aboutPlatformContent.metadataDescription, /Podgoricu|Budvu|Kotor|Tivat/u);
  assert.doesNotMatch(aboutPlatformContent.sections[1].body[0] ?? "", /saobraćaj/i);
});

test("creates minimal AboutPage and breadcrumb structured data without organization claims", () => {
  const structuredData = createAboutPlatformStructuredData();
  const graph = structuredData["@graph"];

  assert.equal(graph[0]?.["@type"], "AboutPage");
  assert.equal(graph[0]?.url, "https://gradom.me/o-platformi");
  assert.equal(graph[1]?.["@type"], "BreadcrumbList");
  assert.deepEqual(graph[1]?.itemListElement, [
    {
      "@type": "ListItem",
      item: "https://gradom.me",
      name: "Početna",
      position: 1,
    },
    {
      "@type": "ListItem",
      item: "https://gradom.me/o-platformi",
      name: "O platformi Gradom.me",
      position: 2,
    },
  ]);
  assert.equal(JSON.stringify(structuredData).includes("Organization"), false);
});

test("uses a self-referencing canonical with concise page-specific metadata", async () => {
  const route = await readFile(
    new URL("../../../app/o-platformi/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /description: aboutPlatformContent\.metadataDescription/u);
  assert.match(route, /title: getPageTitle\("O platformi"\)/u);
  assert.match(route, /canonical: getAboutPlatformPath\(\)/u);

  const metadata = createPublicRouteMetadata({
    canonical: getAboutPlatformPath(),
    description: aboutPlatformContent.metadataDescription,
    title: getPageTitle("O platformi"),
  });

  assert.equal(metadata.alternates?.canonical, "/o-platformi");
  assert.equal(metadata.openGraph?.url, "/o-platformi");
  const title =
    typeof metadata.title === "object" && metadata.title !== null && "absolute" in metadata.title
      ? metadata.title.absolute
      : metadata.title;
  assert.equal(title, "O platformi | Gradom.me");
  assert.equal(metadata.description, aboutPlatformContent.metadataDescription);
  assert.equal(metadata.openGraph?.description, aboutPlatformContent.metadataDescription);
  assert.equal(metadata.twitter?.description, aboutPlatformContent.metadataDescription);
});
