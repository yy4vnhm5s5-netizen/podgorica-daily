import type { ComponentType, SVGProps } from "react";

import {
  MarinaMark,
  MillenniumBridgeMark,
  OldTownWallsMark,
} from "@/shared/components/city-landmark-marks";
import type { CityId } from "@/shared/types/city";

interface CitySignature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

// One landmark per city, chosen for silhouette recognisability over literal accuracy. Cities not
// listed here simply render nothing (see getCitySignature) — adding a future city is one new
// mark component (city-landmark-marks.tsx) plus one entry here, nothing else changes.
const citySignatures: Partial<Record<CityId, CitySignature>> = {
  budva: { icon: OldTownWallsMark, label: "Stari grad" },
  podgorica: { icon: MillenniumBridgeMark, label: "Milenijumski most" },
  tivat: { icon: MarinaMark, label: "Marina" },
};

function getCitySignature(cityId: CityId): CitySignature | undefined {
  return citySignatures[cityId];
}

export { citySignatures, getCitySignature, type CitySignature };
