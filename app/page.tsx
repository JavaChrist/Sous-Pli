import { HomePage } from "@/components/pages/marketing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Secret Santa et tirage au sort de Noël · Sous pli",
  description: "Tirage au sort de Noël en ligne. Secret Santa gratuit en famille, formules association et entreprise. Chacun découvre son destinataire sous pli.",
  path: "/",
  absolute: true,
});

export default function Page() {
  return <HomePage />;
}
