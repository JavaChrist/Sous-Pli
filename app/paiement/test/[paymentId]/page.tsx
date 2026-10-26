import { TestPaymentPage } from "@/components/pages/billing";

export default async function Page({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <TestPaymentPage paymentId={paymentId} />;
}
