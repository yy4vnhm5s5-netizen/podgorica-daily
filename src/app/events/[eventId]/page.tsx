import { redirect } from "next/navigation";

interface EventRedirectPageProps {
  params: Promise<{ eventId: string }>;
}

async function EventRedirectPage({ params }: EventRedirectPageProps) {
  const { eventId } = await params;
  redirect(`/me/events/${encodeURIComponent(eventId)}`);
}

export default EventRedirectPage;
