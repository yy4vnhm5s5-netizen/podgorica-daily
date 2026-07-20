import { permanentRedirect } from "next/navigation";

function EventsRedirectPage() {
  permanentRedirect("/me/events");
}

export default EventsRedirectPage;
