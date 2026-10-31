import { HelpPage } from "@/components/pages/marketing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Aide pour le tirage au sort",
  description: "Comment inviter, tirer au sort et lire le résultat sans dévoiler les paires. Le Secret Santa familial est gratuit.",
  path: "/aide",
});

export default function Page() {
  return <HelpPage />;
}
