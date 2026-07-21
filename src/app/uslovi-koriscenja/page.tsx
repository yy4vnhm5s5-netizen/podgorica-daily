import { permanentRedirect } from "next/navigation";

function TermsRedirectPage() {
  permanentRedirect("/me/uslovi-koriscenja");
}

export default TermsRedirectPage;
