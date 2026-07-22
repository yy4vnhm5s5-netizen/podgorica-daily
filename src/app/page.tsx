import { permanentRedirect } from "next/navigation";

import { getCanonicalMainCityPath } from "@/app/root-redirect";

function HomePage() {
  permanentRedirect(getCanonicalMainCityPath());
}

export default HomePage;
