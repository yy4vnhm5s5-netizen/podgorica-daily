import { getFuelPricesPath } from "@/shared/config/public-routes";
import { siteConfig } from "@/shared/config/site";

interface FuelBreadcrumbStructuredData {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{ "@type": "ListItem"; item: string; name: string; position: number }>;
}

// BreadcrumbList and nothing else, deliberately.
//
// The page states official maximum retail prices the Ministry of Energy and Mining publishes —
// Gradom.me neither sells fuel nor sets those prices, so Product/Offer would assert a commercial
// relationship that does not exist, and GovernmentService would name us as a provider we are not.
// Dataset was considered and rejected: the page publishes no distribution, no license and no
// dataset identity of its own, and Google uses Dataset only for Dataset Search anyway. A plain
// WebPage node would be valid but adds nothing a crawler cannot already read from the canonical
// URL, the title and the visible page.
//
// What is left is the one fact schema.org can carry here that is both true and useful: where this
// page sits in the site. That mirrors the beach and event detail pages, which emit exactly this.
function createFuelBreadcrumbStructuredData(): FuelBreadcrumbStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", item: siteConfig.url, name: "Početna", position: 1 },
      {
        "@type": "ListItem",
        item: new URL(getFuelPricesPath(), siteConfig.url).toString(),
        name: "Cijene goriva",
        position: 2,
      },
    ],
  };
}

function serializeFuelStructuredData(value: FuelBreadcrumbStructuredData) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export {
  createFuelBreadcrumbStructuredData,
  serializeFuelStructuredData,
  type FuelBreadcrumbStructuredData,
};
