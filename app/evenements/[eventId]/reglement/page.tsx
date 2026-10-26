import { CheckoutPage } from "@/components/pages/billing";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <CheckoutPage eventId={eventId} />;
}
