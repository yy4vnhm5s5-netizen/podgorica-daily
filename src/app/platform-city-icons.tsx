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
      <path d="M6 17 12 5 18 17M12 5v12" />
      <line x1="3" x2="21" y1="17" y2="17" />
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
      <path d="M4 19v-7h3v5h3v-5h3v5h3v-5h3v7" />
    </svg>
  );
}

export { CitadelIcon, MillenniumBridgeIcon };
