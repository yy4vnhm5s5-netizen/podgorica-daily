import { permanentRedirect } from "next/navigation";

interface EventRedirectPageProps {
  params: Promise<{ eventId: string }>;
}

async function EventRedirectPage({ params }: EventRedirectPageProps) {
  const { eventId } = await params;
  permanentRedirect(`/dogadjaji/${encodeURIComponent(eventId)}`);
}

export default EventRedirectPage;
