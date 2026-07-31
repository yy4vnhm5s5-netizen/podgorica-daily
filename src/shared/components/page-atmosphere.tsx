interface PageAtmosphereProps {
  variant?: "city-dashboard" | "platform";
}

// One layered, full-bleed atmosphere primitive keeps the platform and city dashboards visually
// related without adding a competing surface inside their content containers. The platform
// variant preserves the existing masked upper-page landscape; city dashboards use the same broad
// radial construction over their whole shell so the cool and warm accents remain imperceptible
// rather than resolving into a banded page gradient.
function PageAtmosphere({ variant = "platform" }: PageAtmosphereProps) {
  const isCityDashboard = variant === "city-dashboard";
  const maskImage = "linear-gradient(to bottom, black 0%, black 45%, transparent 80%)";

  const landscape = isCityDashboard
    ? [
        "radial-gradient(88% 68% at -6% -4%, hsl(195 68% 90% / 0.48) 0%, hsl(195 68% 90% / 0.28) 38%, transparent 78%)",
        "radial-gradient(78% 72% at 106% 94%, hsl(25 58% 93% / 0.28) 0%, hsl(25 58% 93% / 0.14) 34%, transparent 76%)",
        "radial-gradient(105% 88% at 50% 45%, hsl(48 28% 98% / 0.34) 0%, transparent 78%)",
      ].join(", ")
    : [
        "radial-gradient(85% 70% at 6% 4%, hsl(196 78% 78% / 0.55) 0%, hsl(196 78% 78% / 0.55) 32%, transparent 78%)",
        "radial-gradient(82% 65% at 96% 0%, hsl(211 72% 76% / 0.5) 0%, hsl(211 72% 76% / 0.5) 30%, transparent 78%)",
        "radial-gradient(60% 95% at -6% 48%, hsl(203 65% 82% / 0.4) 0%, hsl(203 65% 82% / 0.4) 28%, transparent 75%)",
        "radial-gradient(65% 92% at 102% 42%, hsl(235 55% 72% / 0.38) 0%, hsl(235 55% 72% / 0.38) 28%, transparent 75%)",
        "radial-gradient(105% 55% at 50% -6%, hsl(205 55% 90% / 0.22) 0%, transparent 80%)",
      ].join(", ");
  const wash = isCityDashboard
    ? "linear-gradient(135deg, hsl(197 52% 98% / 0.2) 0%, transparent 42%, hsl(26 42% 97% / 0.14) 100%)"
    : "linear-gradient(160deg, hsl(200 55% 97% / 0.15) 0%, transparent 35%, transparent 100%)";

  return (
    <div
      aria-hidden="true"
      className={
        isCityDashboard
          ? "pointer-events-none absolute inset-0 overflow-hidden"
          : "pointer-events-none absolute -top-24 left-1/2 h-[46rem] w-screen -translate-x-1/2 overflow-hidden sm:h-[40rem]"
      }
      style={isCityDashboard ? undefined : { WebkitMaskImage: maskImage, maskImage }}
    >
      <div
        className={
          isCityDashboard
            ? "absolute inset-0 opacity-70"
            : "absolute inset-0 opacity-75 sm:opacity-60 lg:opacity-50"
        }
      >
        <div className="absolute inset-0" style={{ backgroundImage: landscape }} />
        <div className="absolute inset-0" style={{ backgroundImage: wash }} />
      </div>
    </div>
  );
}

export { PageAtmosphere, type PageAtmosphereProps };
