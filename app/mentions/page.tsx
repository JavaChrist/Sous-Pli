import { MentionsDocument } from "@/components/pages/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mentions légales",
  description: "Éditeur, hébergement et directeur de la publication du site Sous pli.",
  path: "/mentions",
});

export default function Page() {
  return <MentionsDocument />;
}
