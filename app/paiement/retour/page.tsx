import { PaymentReturnPage } from "@/components/pages/billing";

export default async function Page({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const params = await searchParams;
  return <PaymentReturnPage paymentId={params.payment ?? ""} />;
}
