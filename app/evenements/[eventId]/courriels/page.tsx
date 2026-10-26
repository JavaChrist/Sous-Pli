import { MailPage } from "@/components/pages/organizer";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <MailPage eventId={eventId} />;
}
