type RoadAlertType = "alternating" | "closure" | "restriction" | "roadwork" | "warning";

interface RoadAlert {
  affectedRoad: string;
  description: string;
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
