import { DeniedPage } from "@/components/pages/marketing";
import { noIndex } from "@/lib/seo";

export const metadata = noIndex;

export default function Page() {
  return <DeniedPage />;
}
