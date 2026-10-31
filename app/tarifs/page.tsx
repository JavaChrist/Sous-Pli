import { PricingPage } from "@/components/pages/billing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Tarifs du Secret Santa",
  description: "Famille gratuite jusqu'à 50 personnes. Association 9,90 €, entreprise 19,90 €, jusqu'à 300 collègues pour 39,90 €. Les participants ne paient pas.",
  path: "/tarifs",
});

export default function Page() {
  return <PricingPage />;
}
