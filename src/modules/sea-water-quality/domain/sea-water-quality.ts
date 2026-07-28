type SeaWaterQualityGrade = "excellent" | "good" | "poor" | "satisfactory";

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
  municipality: "budva";
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
  type SeaWaterQualitySummary,
};
