// The exact shared atmosphere used by the platform homepage and city dashboards: overlapping,
// broad radial layers plus a faint wash, contained to the upper page by one soft mask. Keeping
// this as a single component prevents their gradients, position, and opacity from drifting apart.
function PageAtmosphere() {
  const maskImage = "linear-gradient(to bottom, black 0%, black 45%, transparent 80%)";

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
      <div className="absolute inset-0 opacity-75 sm:opacity-60 lg:opacity-50">
        <div className="absolute inset-0" style={{ backgroundImage: landscape }} />
        <div className="absolute inset-0" style={{ backgroundImage: wash }} />
      </div>
    </div>
  );
}

export { PageAtmosphere };
