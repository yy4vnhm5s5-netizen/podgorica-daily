import { getCachedMonteGigsGoingOut } from "../infrastructure/montegigs-going-out";

function getGoingOutEvents() {
  return getCachedMonteGigsGoingOut();
}

export { getGoingOutEvents };
