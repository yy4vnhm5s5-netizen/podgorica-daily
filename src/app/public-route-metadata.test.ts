import assert from "node:assert/strict";
import test from "node:test";

import { createPublicRouteMetadata } from "./public-route-metadata.ts";
import {
  getAboutPlatformPath,
  getCinemaPath,
  getContactPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
} from "@/shared/config/public-routes";

test("uses self-referencing canonical and Open Graph URLs for every public route shape", () => {
  const paths = [
    "/podgorica",
    getEventsPath("podgorica"),
    getGoingOutPath("podgorica"),
    getCinemaPath("podgorica"),
    getFlightsPath("podgorica"),
    getElectricityPath("podgorica"),
    getAboutPlatformPath(),
    getContactPath(),
    getTermsOfUsePath(),
    getPrivacyPolicyPath(),
  ];

  for (const canonical of paths) {
    const metadata = createPublicRouteMetadata({
      canonical,
      description: `Description for ${canonical}`,
      title: `Title for ${canonical}`,
    });

    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(metadata.openGraph?.url, canonical);
    assert.match(JSON.stringify(metadata.openGraph), /"siteName":"Gradom\.me"/u);
    assert.match(JSON.stringify(metadata.openGraph), /"type":"website"/u);
    assert.match(JSON.stringify(metadata.twitter), /"card":"summary_large_image"/u);
    assert.notEqual(metadata.alternates?.canonical, "/");
  }
});

test("keeps an event-detail fallback description page-specific", () => {
  const metadata = createPublicRouteMetadata({
    canonical: "/podgorica/dogadjaji/example-event",
    description: "Informacije o događaju Example event u Podgorici.",
    title: "Example event | Gradom.me",
  });

  assert.equal(metadata.description, "Informacije o događaju Example event u Podgorici.");
  assert.equal(metadata.openGraph?.description, metadata.description);
  assert.equal(metadata.twitter?.description, metadata.description);
});

test("uses the default Gradom.me social image unless a route provides its own", () => {
  const defaultMetadata = createPublicRouteMetadata({
    canonical: "/podgorica/letovi",
    title: "Letovi za Podgoricu | Gradom.me",
  });
  const eventMetadata = createPublicRouteMetadata({
    canonical: "/podgorica/dogadjaji/example-event",
    imageUrl: "https://example.test/event.jpg",
    title: "Example event | Gradom.me",
  });

  assert.deepEqual(defaultMetadata.openGraph?.images, [
    { height: 675, url: "/og-image.png", width: 1200 },
  ]);
  assert.deepEqual(defaultMetadata.twitter?.images, ["/og-image.png"]);
  assert.deepEqual(eventMetadata.openGraph?.images, [{ url: "https://example.test/event.jpg" }]);
  assert.deepEqual(eventMetadata.twitter?.images, ["https://example.test/event.jpg"]);
});

test("allows a public page to use its exact published brand name in social metadata", () => {
  const metadata = createPublicRouteMetadata({
    canonical: getContactPath(),
    siteName: "Gradom.me",
    title: "Partnerstva i saradnja | Gradom.me",
  });

  assert.match(JSON.stringify(metadata.openGraph), /"siteName":"Gradom\.me"/u);
  assert.match(JSON.stringify(metadata.title), /Partnerstva i saradnja \| Gradom\.me/u);
});
