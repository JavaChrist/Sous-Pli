import type { Metadata } from "next";
import { InvitationPage } from "@/components/pages/participant";

export const metadata: Metadata = { referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationPage token={token} />;
}
