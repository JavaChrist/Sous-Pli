import type { Metadata } from "next";
import { JoinPage } from "@/components/pages/participant";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinPage code={code} />;
}
