import { DeletionRequestDocument } from "@/components/pages/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Suppression du compte",
  description: "Demander la suppression d'un compte Sous pli et comprendre ce qui est conservé.",
  path: "/suppression-compte",
});

export default function Page() {
  return <DeletionRequestDocument />;
}
