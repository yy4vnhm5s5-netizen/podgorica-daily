type SeaWaterQualityGrade = "excellent" | "good" | "poor" | "satisfactory";

// The set of municipalities the Morsko dobro monitoring source is wired for in this codebase —
// not the full national list of coastal municipalities, just the ones this app collects today.
type SeaWaterQualityMunicipality = "bar" | "budva" | "kotor" | "tivat";

interface SeaWaterQualityGradeCounts {
  excellent: number;
  good: number;
  poor: number;
  satisfactory: number;
}

interface SeaWaterQualityLocation {
  beachName?: string;
  grade: SeaWaterQualityGrade;
  id: number;
  name: string;
  samplingDateTime?: string;
  samplingDate?: string;
}

interface SeaWaterQualityHistoryMeasurement {
  grade: SeaWaterQualityGrade;
  samplingDate?: string;
  samplingDateTime?: string;
  sourceRound: number;
}

// A JPMD monitoring point is identified by the official source id within its municipality.
// The human-facing canonicalSlug is deliberately stored once when the point is first observed:
// a later editorial rename updates displayName without changing its public URL.
interface SeaWaterQualityHistoryLocation {
  beachName?: string;
  canonicalSlug: string;
  displayName: string;
  firstSeenRound: number;
  lastSeenRound: number;
  measurements: SeaWaterQualityHistoryMeasurement[];
  presentInLatestRound: boolean;
  sourceLocationId: number;
}

interface SeaWaterQualityHistory {
  latestRound: number;
  locations: SeaWaterQualityHistoryLocation[];
  municipality: SeaWaterQualityMunicipality;
  sourceMunicipalityId: number;
  year: number;
}

interface SeaWaterQualitySummary {
  gradeCounts: SeaWaterQualityGradeCounts;
  latestSamplingDate?: string;
  locations: SeaWaterQualityLocation[];
  municipality: SeaWaterQualityMunicipality;
  totalLocations: number;
}

function createEmptySeaWaterQualityGradeCounts(): SeaWaterQualityGradeCounts {
  return { excellent: 0, good: 0, poor: 0, satisfactory: 0 };
}

export {
  createEmptySeaWaterQualityGradeCounts,
  type SeaWaterQualityGrade,
  type SeaWaterQualityGradeCounts,
  type SeaWaterQualityHistory,
  type SeaWaterQualityHistoryLocation,
  type SeaWaterQualityHistoryMeasurement,
  type SeaWaterQualityLocation,
  type SeaWaterQualityMunicipality,
  type SeaWaterQualitySummary,
};
