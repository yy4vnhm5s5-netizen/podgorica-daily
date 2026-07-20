import { permanentRedirect } from "next/navigation";

function ContactRedirectPage() {
  permanentRedirect("/me/kontakt");
}

export default ContactRedirectPage;
