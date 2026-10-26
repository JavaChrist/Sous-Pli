import { WishesPage } from "@/components/pages/participant";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <WishesPage eventId={eventId} />;
}
