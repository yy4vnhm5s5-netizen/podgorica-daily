import { permanentRedirect } from "next/navigation";

function GoingOutRedirectPage() {
  permanentRedirect("/me/izlasci");
}

export default GoingOutRedirectPage;
