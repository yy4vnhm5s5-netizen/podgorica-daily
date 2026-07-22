import { permanentRedirect } from "next/navigation";

function FlightsRedirectPage() {
  permanentRedirect("/me/letovi");
}

export default FlightsRedirectPage;
