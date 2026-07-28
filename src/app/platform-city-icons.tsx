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

// Buća Palace (Tivat's landmark 18th-century palace) — a pedimented facade with a centered
// entrance, the same minimal-silhouette treatment as the bridge/citadel marks above.
function BucaPalaceIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4 20V10L12 4l8 6v10" />
      <path d="M10 20v-6h4v6" />
      <line x1="2" x2="22" y1="20" y2="20" />
    </svg>
  );
}

export { BucaPalaceIcon, CitadelIcon, MillenniumBridgeIcon };
