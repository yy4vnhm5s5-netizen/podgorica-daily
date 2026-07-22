import assert from "node:assert/strict";
import test from "node:test";

import { createPublicRouteMetadata } from "./public-route-metadata.ts";
import {
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
    assert.notEqual(metadata.alternates?.canonical, "/");
  }
});

test("keeps an event-detail fallback description page-specific", () => {
  const metadata = createPublicRouteMetadata({
    canonical: "/podgorica/dogadjaji/example-event",
    description: "Informacije o događaju Example event u Podgorici.",
    title: "Example event | Gradom",
  });

  assert.equal(metadata.description, "Informacije o događaju Example event u Podgorici.");
  assert.equal(metadata.openGraph?.description, metadata.description);
  assert.equal(metadata.twitter?.description, metadata.description);
});
