import { ExclusionsPage } from "@/components/pages/organizer";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <ExclusionsPage eventId={eventId} />;
}
