import { getCityName } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

// House advertising for the beach surfaces. Contextual only in the sense that it names the city
// the reader is already browsing — it is not personalised, does not read cookies or location, and
// never varies with the water-quality grade, which would imply JPMD endorsement.
//
// Copy is deliberately short and matches the tone of the existing dashboard placement
// ("Vaša reklama može biti ovdje" / "Kontaktirajte nas →").
const seaWaterQualityAdvertisingLabel = "Oglas";
const seaWaterQualityAdvertisingCta = "Kontaktirajte nas →";
const seaWaterQualityAdvertisingTitle = "Vaš biznis može biti ovdje";

function getSeaWaterQualityAdvertisingDescription(city: City, surface: "detail" | "listing") {
  const offer = "restoran, beach bar, smještaj ili drugu lokalnu ponudu";
  return surface === "detail"
    ? `Predstavite svoj ${offer} posjetiocima koji provjeravaju ovo kupalište.`
    : `Predstavite svoj ${offer} posjetiocima koji istražuju plaže u ${getCityName(
        city,
        "locative",
      )}.`;
}

export {
  getSeaWaterQualityAdvertisingDescription,
  seaWaterQualityAdvertisingCta,
  seaWaterQualityAdvertisingLabel,
  seaWaterQualityAdvertisingTitle,
};
