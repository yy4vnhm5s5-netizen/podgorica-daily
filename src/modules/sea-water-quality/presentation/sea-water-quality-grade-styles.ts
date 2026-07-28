import type { SeaWaterQualityGrade } from "../domain/sea-water-quality";

const gradeOrder: readonly SeaWaterQualityGrade[] = ["excellent", "good", "satisfactory", "poor"];

const gradeLabels: Record<SeaWaterQualityGrade, string> = {
  excellent: "Odlična",
  good: "Dobra",
  poor: "Loša",
  satisfactory: "Zadovoljavajuća",
};

// Light, understated status colors consistent with the rest of the dashboard's tone system —
// backgrounds stay at the palest shade so grade indicators read as a subtle status, not a
// colorful chart. Shared between the dashboard card and the full beach-list page so both surfaces
// use the exact same palette.
const gradeStyles: Record<SeaWaterQualityGrade, string> = {
  excellent: "border-green-100 bg-green-50 text-green-700",
  good: "border-lime-100 bg-lime-50 text-lime-700",
  poor: "border-red-100 bg-red-50 text-red-700",
  satisfactory: "border-amber-100 bg-amber-50 text-amber-700",
};

export { gradeLabels, gradeOrder, gradeStyles };
