# UX architecture

> **Authoritative guidance:** Future implementation plans that change product or UX architecture must read this document together with [PRODUCT_VISION.md](PRODUCT_VISION.md). It describes user-facing structure; technical boundaries remain in [ARCHITECTURE.md](ARCHITECTURE.md).

## Homepage purpose

`/` is the Gradom.me platform homepage, not a city dashboard. It introduces the platform, lets people enter a supported city, and provides visible explanatory content that remains useful when only one city is active.

`/podgorica` and every future active city landing route are separate local products. The platform homepage must never become a clone of Podgorica by showing city-only modules, a hidden city dashboard, or a second canonical version of a city page.

## Homepage structure

1. **Hero:** Gradom.me brand, one clear H1, a concise explanation, and a visible city-selection path.
2. **City selection:** Only active registry cities are rendered as crawlable City Cards. Inactive cities are neither listed nor hinted at publicly.
3. **City information:** Visible text explains that local sources and useful modules differ by city.
4. **FAQ:** Visible, concise answers about coverage, sources, refresh behaviour, and free public access. It is for people first, not hidden SEO text.

The homepage uses a self canonical URL and platform-specific metadata. City pages use their own self canonical URLs and city-specific metadata.

## City Card anatomy

A City Card is a generic presentation component. It receives view data and does not know whether a highlight represents flights, weather, beaches, or another domain.

- city name and concise registry-owned description;
- a full-card, keyboard-accessible city link with a visible **Otvori grad** action;
- two to six priority-ordered City Highlights;
- a concise set of capability-derived module shortcuts;
- no nested interactive controls;
- visible focus states, meaningful link labels, and responsive single-column behaviour on narrow screens.

An optional approved local image can be introduced later. Until then, cards use the established image-free Gradom.me visual system rather than generic city photography.

## City Highlights contract

City Highlight view data contains a stable key, label, short display value, semantic visual identifier, optional city-relative link, accessibility label, and priority. The card renders this contract generically.

The homepage composition layer derives highlights only from existing application/read-model services. It does not reimplement provider parsing, normalisation, source timing, or cache rules. A highlight source may be unavailable without preventing the page or other highlights from rendering.

## Capabilities and shortcuts

Shortcuts come from the active city’s declared capabilities, the enabled public feature set, and central route helpers. A capability without a public route is not shown as a shortcut. This prevents copied Podgorica navigation and avoids exposing unsupported city routes.

## Route hierarchy

- `/` is the canonical platform homepage.
- `/{active-city}` is the canonical landing page for that local product.
- `/{active-city}/…` contains only routes supported by that city’s active capabilities.
- `/kontakt`, `/o-platformi`, and legal pages are global platform routes.

Inactive city slugs use the normal not-found path and never receive a public redirect, sitemap entry, canonical URL, or card.

## Active cities, inactive cities, and last city

Only active cities receive public routes, static generation, city cards, sitemap entries, and platform structured-data entries. Inactive city configuration is planning data and remains invisible to public users.

The optional **Nastavi gdje ste stali** experience stores only a last active city ID in browser local storage. It validates that ID against the active registry, ignores invalid, removed, and inactive values, and never hides other cities. The server-rendered homepage remains useful without local storage; client enhancement must not create a hydration mismatch or meaningful layout shift. With a single active city, it remains visually absent to avoid redundancy.

## Responsive, semantic, and accessible behaviour

- Keep the primary reading order: hero, city selection, city explanation, FAQ.
- Use one H1 and meaningful H2/H3 sections; headings are not decorative styling.
- Use anchors for navigation and native disclosure controls for FAQ answers.
- Every card action and shortcut is keyboard reachable with a visible focus state.
- Icon-only visual treatment is paired with text or an accessible label.
- Respect reduced motion and avoid nonessential client JavaScript.
- Cards use fluid grids: one column on narrow screens, additional columns only when space permits.

## Scaling to many cities

As the active city list grows, the same registry-derived card collection remains the entry point. The homepage may later add lightweight grouping or search only after there are enough active cities to justify it. It must continue to prioritise city choice over a universal dashboard, retain meaningful descriptions, and keep inactive cities out of public UX and SEO surfaces.
