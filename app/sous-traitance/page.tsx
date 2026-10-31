import { ProcessingAnnex } from "@/components/pages/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sous-traitance",
  description: "Annexe de sous-traitance pour un échange organisé dans une structure.",
  path: "/sous-traitance",
});

export default function Page() {
  return <ProcessingAnnex />;
}
