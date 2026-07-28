type SeaWaterQualityGrade = "excellent" | "good" | "poor" | "satisfactory";

interface SeaWaterQualityGradeCounts {
  excellent: number;
  good: number;
  poor: number;
  satisfactory: number;
}

interface SeaWaterQualitySummary {
  gradeCounts: SeaWaterQualityGradeCounts;
  latestSamplingDate?: string;
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
  type SeaWaterQualitySummary,
};
