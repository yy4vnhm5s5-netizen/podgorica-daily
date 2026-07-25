import assert from "node:assert/strict";
import test from "node:test";

import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getAboutPlatformPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import {
  aboutPlatformContent,
  createAboutPlatformStructuredData,
} from "./about-platform-content.ts";
import { getMainCity } from "@/shared/config/cities";

test("provides the page heading and only currently public information categories", () => {
  assert.equal(aboutPlatformContent.heading, "O platformi Gradom.me");
  assert.deepEqual(
    aboutPlatformContent.sections.map(({ heading }) => heading),
    [
      "Lokalne informacije na jednom mjestu",
      "Šta možete pronaći",
      "Kako platforma radi",
      "Svježina i dostupnost podataka",
      "Nezavisnost i ispravke",
    ],
  );
  assert.match(aboutPlatformContent.sections[1].body[0] ?? "", /vremenska prognoza/i);
  assert.doesNotMatch(aboutPlatformContent.sections[1].body[0] ?? "", /saobraćaj/i);
});

test("creates minimal AboutPage and breadcrumb structured data without organization claims", () => {
  const structuredData = createAboutPlatformStructuredData(getMainCity());
  const graph = structuredData["@graph"];

  assert.equal(graph[0]?.["@type"], "AboutPage");
  assert.equal(graph[0]?.url, "https://gradom.me/o-platformi");
  assert.equal(graph[1]?.["@type"], "BreadcrumbList");
  assert.deepEqual(graph[1]?.itemListElement, [
    {
      "@type": "ListItem",
      item: "https://gradom.me/podgorica",
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

test("uses a self-referencing canonical with page-specific metadata", () => {
  const metadata = createPublicRouteMetadata({
    canonical: getAboutPlatformPath(),
    description: aboutPlatformContent.description,
    title: getPageTitle(aboutPlatformContent.heading),
  });

  assert.equal(metadata.alternates?.canonical, "/o-platformi");
  assert.equal(metadata.openGraph?.url, "/o-platformi");
  const title =
    typeof metadata.title === "object" && metadata.title !== null && "absolute" in metadata.title
      ? metadata.title.absolute
      : metadata.title;
  assert.equal(title, "O platformi Gradom.me | Gradom");
  assert.equal(metadata.description, aboutPlatformContent.description);
});
