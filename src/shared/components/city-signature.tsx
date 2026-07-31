import { getCitySignature } from "@/shared/config/city-signatures";
import type { CityId } from "@/shared/types/city";
import { cn } from "@/shared/lib/utils";

interface CitySignatureProps {
  /** Position/size/clip for this call site, e.g. "-right-20 top-16 w-[420px] h-[210px]". The
   * component only supplies the shared visual treatment (tint, opacity, stroke, responsive
   * hiding) — placement is always the caller's responsibility, same as the floating decorative
   * icons elsewhere in the app. */
  className?: string;
  cityId: CityId;
}

// A single, very faint landmark silhouette identifying one city — an "environmental" background
// element, not a UI icon: inert to pointer input, out of the accessibility tree, hidden below
// `md:` (no room for it at narrow widths), and rendered nothing at all for a city without a mark
// registered yet, so future cities degrade gracefully instead of erroring.
function CitySignature({ cityId, className }: CitySignatureProps) {
  const signature = getCitySignature(cityId);
  if (!signature) return null;

  const Icon = signature.icon;

  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute hidden text-slate-500 opacity-[0.05] md:block",
        className,
      )}
    />
  );
}

export { CitySignature, type CitySignatureProps };
