// Shared atmosphere layer: a Firefox-style gradient "landscape" — a handful of very large,
// irregular elliptical radial gradients (deliberately non-circular, different width/height radii
// and aspect ratios per shape) layered on ONE full-size surface so they overlap heavily and merge
// into a single continuous field, rather than reading as discrete blobs. A second, much fainter
// full-size linear wash sits on top purely to unify the composition's overall light direction. A
// mask on the wrapper concentrates the whole thing in the upper half of the page and dissolves it
// to fully transparent by mid-page; a single opacity multiplier makes it slightly stronger on
// mobile than desktop. The wrapper starts above the page content's own top edge (-top-24, with
// height increased to match) so it reaches behind the header instead of cutting off beneath it.
// Full-bleed breakout (left-1/2 + w-screen + -translate-x-1/2) so it spans the real viewport
// width, not the inner max-w content column, with no horizontal/vertical overflow. Must be
// rendered as the first child of a `relative` container so normal DOM paint order keeps it behind
// every other child with no z-index bookkeeping. This is the single shared implementation used by
// both the platform homepage and the contact page — do not fork or duplicate it; import this
// component wherever the same atmosphere is needed instead.
function PlatformAtmosphere() {
  const maskImage = "linear-gradient(to bottom, black 0%, black 55%, transparent 88%)";

  const landscape = [
    "radial-gradient(85% 70% at 6% 4%, hsl(196 78% 78% / 0.55) 0%, hsl(196 78% 78% / 0.55) 32%, transparent 78%)",
    "radial-gradient(82% 65% at 96% 0%, hsl(211 72% 76% / 0.5) 0%, hsl(211 72% 76% / 0.5) 30%, transparent 78%)",
    "radial-gradient(60% 95% at -6% 48%, hsl(203 65% 82% / 0.4) 0%, hsl(203 65% 82% / 0.4) 28%, transparent 75%)",
    "radial-gradient(65% 92% at 102% 42%, hsl(235 55% 72% / 0.38) 0%, hsl(235 55% 72% / 0.38) 28%, transparent 75%)",
    "radial-gradient(105% 55% at 50% -6%, hsl(205 55% 90% / 0.22) 0%, transparent 80%)",
  ].join(", ");
  const wash =
    "linear-gradient(160deg, hsl(200 55% 97% / 0.15) 0%, transparent 35%, transparent 100%)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 h-[46rem] w-screen -translate-x-1/2 overflow-hidden sm:h-[40rem]"
      style={{ WebkitMaskImage: maskImage, maskImage }}
    >
      <div className="absolute inset-0 opacity-100 sm:opacity-80 lg:opacity-65">
        <div className="absolute inset-0" style={{ backgroundImage: landscape }} />
        <div className="absolute inset-0" style={{ backgroundImage: wash }} />
      </div>
    </div>
  );
}

export { PlatformAtmosphere };
