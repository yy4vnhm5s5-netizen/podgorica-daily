import type { SVGProps } from "react";

// Large-format city "signature" landmarks — one recognisable local silhouette per city, drawn as
// a single-stroke outline meant to be rendered huge and very faint as a page background element
// (see city-signature.tsx), never as a foreground UI glyph. Deliberately independent from the
// small 24x24 identity marks in @/app/platform-city-icons.tsx (those are tuned for a ~20px chip
// and are under exact-match test coverage) — same restrained visual language (currentColor,
// rounded caps, no fills, no tiny details), just redrawn at a wider aspect ratio that reads as a
// landmark silhouette rather than a compact icon.

// Podgorica — the Millennium Bridge: a single cable-stayed span, simplified to its two main legs
// plus two inner fan cables and the deck line.
function MillenniumBridgeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      viewBox="0 0 320 160"
      {...props}
    >
      <path d="M40 130 160 30 280 130" />
      <path d="M160 30 100 130M160 30 220 130" />
      <line x1="20" x2="300" y1="130" y2="130" />
    </svg>
  );
}

// Budva — the Old Town walls: a stepped fortress-wall profile with towers of varying height,
// tracing the shape of the walled peninsula.
function OldTownWallsMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      viewBox="0 0 320 160"
      {...props}
    >
      <path d="M20 140V90h40v20h20V90h40V70h30v20h40V60h40v30h40v20h30v30" />
    </svg>
  );
}

// Tivat — the marina: two masts of different heights with simple open sail/pennant shapes above
// a waterline, evoking Porto Montenegro's waterfront without drawing crane machinery detail.
function MarinaMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      viewBox="0 0 320 160"
      {...props}
    >
      <path d="M120 30V140M120 42 150 57 120 67" />
      <path d="M220 60V140M220 70 242 80 220 88" />
      <line x1="20" x2="300" y1="140" y2="140" />
    </svg>
  );
}

export { MarinaMark, MillenniumBridgeMark, OldTownWallsMark };
