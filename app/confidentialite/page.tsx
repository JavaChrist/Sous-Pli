import { PrivacyDocument } from "@/components/pages/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Confidentialité",
  description: "Politique de confidentialité de Sous pli : données du compte, de l'échange et des paiements, et durée de conservation.",
  path: "/confidentialite",
});

export default function Page() {
  return <PrivacyDocument />;
}
