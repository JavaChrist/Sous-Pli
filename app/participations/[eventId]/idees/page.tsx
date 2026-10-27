import { IdeasPage } from "@/components/pages/participant";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <IdeasPage eventId={eventId} />;
}
