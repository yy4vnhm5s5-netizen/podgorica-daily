type SeaWaterQualityGrade = "excellent" | "good" | "poor" | "satisfactory";

// The set of municipalities the Morsko dobro monitoring source is wired for in this codebase —
// not the full national list of coastal municipalities, just the ones this app collects today.
type SeaWaterQualityMunicipality = "budva" | "tivat";

interface SeaWaterQualityGradeCounts {
  excellent: number;
  good: number;
  poor: number;
  satisfactory: number;
}

interface SeaWaterQualityLocation {
  grade: SeaWaterQualityGrade;
  id: number;
  name: string;
  samplingDate?: string;
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
  type SeaWaterQualityLocation,
  type SeaWaterQualityMunicipality,
  type SeaWaterQualitySummary,
};
