import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// This file's components are inline SVG-returning .tsx functions; the project's established
// pattern for testing presentation-layer structure (see platform-homepage.test.ts) is to read
// the source and assert on it directly, rather than importing/rendering the .tsx module — no
// other test in this codebase imports a .tsx file, and this suite follows that same convention.
const source = async () => readFile(new URL("./platform-city-icons.tsx", import.meta.url), "utf8");
const panelSource = async () =>
  readFile(new URL("./platform-city-panel.tsx", import.meta.url), "utf8");

test("replaces the unreadable Buća Palace mark with a minimal marina/sail identity for Tivat", async () => {
  const text = await source();

  assert.doesNotMatch(text, /BucaPalaceIcon/u);
  assert.match(text, /function MarinaSailIcon/u);
  assert.match(text, /export \{ CitadelIcon, MarinaSailIcon, MillenniumBridgeIcon \}/u);
});

test("keeps the new Tivat mark on the same SVG conventions as the Podgorica and Budva marks", async () => {
  const text = await source();
  const marinaSailMatch = text.match(/function MarinaSailIcon[\s\S]*?\n\}\n/u);
  assert.ok(marinaSailMatch);
  const icon = marinaSailMatch[0];

  assert.match(icon, /aria-hidden="true"/u);
  assert.match(icon, /fill="none"/u);
  assert.match(icon, /stroke="currentColor"/u);
  assert.match(icon, /strokeLinecap="round"/u);
  assert.match(icon, /strokeLinejoin="round"/u);
  assert.match(icon, /strokeWidth=\{1\.8\}/u);
  assert.match(icon, /viewBox="0 0 24 24"/u);
  assert.match(icon, /\{\.\.\.props\}/u);
});

test("is a minimal sail/mast/waterline mark with no airplane, text, or embedded color", async () => {
  const text = await source();
  const marinaSailMatch = text.match(/function MarinaSailIcon[\s\S]*?\n\}\n/u);
  assert.ok(marinaSailMatch);
  const icon = marinaSailMatch[0];

  // Exactly one mast/sail path plus one waterline — no extra ornamentation, no plane/wing shapes.
  assert.equal([...icon.matchAll(/<path /gu)].length, 1);
  assert.equal([...icon.matchAll(/<line /gu)].length, 1);
  assert.doesNotMatch(icon.toLowerCase(), /plane|airport|wing/u);
  assert.doesNotMatch(icon, /<text/u);
  assert.doesNotMatch(icon, /#[0-9a-fA-F]{3,6}\b/u);
});

test("registers Tivat's identity icon, style, and card tint on the renamed MarinaSailIcon", async () => {
  const text = await panelSource();

  assert.match(text, /import \{ CitadelIcon, MarinaSailIcon, MillenniumBridgeIcon \}/u);
  assert.ok(text.includes("tivat: MarinaSailIcon,"));
  assert.ok(
    text.includes('tivat: "bg-[hsl(var(--accent-tivat-soft))] text-[hsl(var(--accent-tivat))]",'),
  );
  assert.doesNotMatch(text, /BucaPalaceIcon/u);
});

test("maps Kotor to the existing Castle icon instead of the generic landmark fallback", async () => {
  const text = await panelSource();

  assert.match(text, /\bCastle\b/u);
  assert.ok(text.includes("kotor: Castle,"));
  assert.ok(text.includes('kotor: "bg-slate-100 text-slate-700",'));
  assert.doesNotMatch(text, /kotor:\s*Landmark/u);
});

test("maps Bar to Lucide's Ship icon instead of the generic landmark fallback", async () => {
  const text = await panelSource();

  assert.match(text, /\bShip\b/u);
  assert.ok(text.includes("bar: Ship,"));
  assert.doesNotMatch(text, /bar:\s*Landmark/u);
  assert.ok(text.includes("budva: CitadelIcon,"));
  assert.ok(text.includes("kotor: Castle,"));
  assert.ok(text.includes("podgorica: MillenniumBridgeIcon,"));
  assert.ok(text.includes("tivat: MarinaSailIcon,"));
});

test("maps Ulcinj to the Umbrella beach glyph through the same cityIdentityIcons map", async () => {
  const text = await panelSource();
  const map = text.match(/const cityIdentityIcons[\s\S]*?\n\};\n/u);
  assert.ok(map);

  // Same mechanism as every other city: one entry in cityIdentityIcons, no Ulcinj branch, no
  // Ulcinj-specific style override, container/size/stroke untouched.
  assert.ok(map[0].includes("ulcinj: Umbrella,"));
  assert.match(text, /^\s+Umbrella,$/mu);
  assert.doesNotMatch(text, /ulcinj:\s*Landmark/u);
  // Exactly one mention in the whole component: the map entry. Anything more would mean an
  // Ulcinj-specific branch, style override or rendering path.
  assert.equal([...text.matchAll(/ulcinj/gu)].length, 1);

  // The other cities keep exactly the icons they already had.
  assert.ok(map[0].includes("bar: Ship,"));
  assert.ok(map[0].includes("budva: CitadelIcon,"));
  assert.ok(map[0].includes("kotor: Castle,"));
  assert.ok(map[0].includes("podgorica: MillenniumBridgeIcon,"));
  assert.ok(map[0].includes("tivat: MarinaSailIcon,"));
});
