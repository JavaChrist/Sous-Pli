import { TermsDocument } from "@/components/pages/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Conditions",
  description: "Conditions d'utilisation de Sous pli pour organiser un échange de cadeaux secret.",
  path: "/conditions",
});

export default function Page() {
  return <TermsDocument />;
}
