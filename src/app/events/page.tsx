import { redirect } from "next/navigation";

function EventsRedirectPage() {
  redirect("/me/events");
}

export default EventsRedirectPage;
