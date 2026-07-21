import { permanentRedirect } from "next/navigation";

function PrivacyPolicyRedirectPage() {
  permanentRedirect("/me/politika-privatnosti");
}

export default PrivacyPolicyRedirectPage;
