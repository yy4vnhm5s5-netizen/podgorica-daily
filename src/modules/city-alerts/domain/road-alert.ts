import type { CityId } from "@/shared/types/city";

type RoadAlertType = "alternating" | "closure" | "restriction" | "roadwork" | "warning";

interface RoadAlert {
  affectedRoad: string;
  description: string;
  cityIds: CityId[];
  id: string;
  municipality?: string;
  source: "AMSCG";
  sourceUrl: string;
  title: string;
  type: RoadAlertType;
  validFrom?: Date;
  validUntil?: Date;
  validity?: string;
}

export { type RoadAlert, type RoadAlertType };
