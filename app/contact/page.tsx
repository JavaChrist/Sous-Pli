import { ContactPage } from "@/components/pages/marketing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact",
  description: "Écrire à Sous pli. Le message est enregistré. L'adresse de support est support@souspli.fr.",
  path: "/contact",
});

export default function Page() {
  return <ContactPage />;
}
