import type { SVGProps } from "react";

// Minimal, geometric city identity marks — a small logo mark, not an illustration. Stroke-based
// and currentColor-driven, matching the same visual convention and weight as the Lucide icons
// used elsewhere, so they inherit the existing icon chip's tint color with no new styling.

function MillenniumBridgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M4 17 12 9 20 17M12 9v8" />
      <line x1="2" x2="22" y1="17" y2="17" />
    </svg>
  );
}

function CitadelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M4 20v-10h4v3h2v-3h4v3h2v-3h4v10" />
    </svg>
  );
}

// Tivat's marina/waterfront identity (Porto Montenegro) — a single mast and sail above a
// waterline, deliberately simpler than the bridge/citadel marks (2 primitives, not 3) since the
// previous Buća Palace mark did not read clearly at the ~20-24px size the city selector and city
// card render it at. No hull is drawn: the mast meeting the waterline is enough to read as a
// boat, the same way the bridge mark implies its deck without drawing one.
function MarinaSailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 5v15M12 6l6 8h-6" />
      <line x1="2" x2="22" y1="20" y2="20" />
    </svg>
  );
}

// Ulcinj's coastal identity: a sun above two wave lines, nothing else. Lucide ships no beach or
// shoreline glyph, so this takes the same custom-mark route as the bridge/citadel/sail marks —
// and like them it stays at two shapes, which is all that survives at the 20-24px size it renders
// at. No sand, no parasol, no scene.
function SunWavesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="12" cy="7" r="3.5" />
      <path d="M3 15c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" />
      <path d="M3 19c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" />
    </svg>
  );
}

export { CitadelIcon, MarinaSailIcon, MillenniumBridgeIcon, SunWavesIcon };
