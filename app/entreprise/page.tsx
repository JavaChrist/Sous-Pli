import { GuideArticle } from "@/components/pages/guides";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Secret Santa entre collègues",
  description: "Échange de cadeaux au travail : 19,90 € jusqu'à 100 collègues, 39,90 € jusqu'à 300. Les coorganisateurs ne voient pas les paires.",
  path: "/entreprise",
});

const faq = [
  {
    q: "Combien coûte un Secret Santa d'entreprise ?",
    a: "19,90 € jusqu'à 100 participants, ou 39,90 € jusqu'à 300 avec Entreprise Plus. Au-delà, la demande est un devis et aucun débit n'est lancé depuis l'application.",
  },
  {
    q: "Peut-on éviter qu'un service se tire entre lui ?",
    a: "Oui. Les exclusions de groupe, comme les exclusions entre deux personnes, sont disponibles dans toutes les formules.",
  },
  {
    q: "Un coorganisateur voit-il les résultats ?",
    a: "Non. Avec Entreprise Plus, les coorganisateurs aident à suivre l'événement, mais ils ne voient pas les attributions secrètes.",
  },
];

export default function Page() {
  return (
    <GuideArticle
      eyebrow="Entreprise"
      title="Échange de cadeaux entre collègues"
      lead="Organisez le Secret Santa du bureau sans publier les paires. L'organisateur paie une fois, les collègues ne paient pas, et chacun découvre son destinataire de son côté."
      sections={[
        {
          title: "Deux tailles, un seul paiement",
          paragraphs: [
            "Jusqu'à 100 collègues, l'offre Entreprise coûte 19,90 €. Jusqu'à 300, Entreprise Plus coûte 39,90 €. Il n'y a pas d'abonnement. Une montée d'Entreprise vers Entreprise Plus est possible avant le tirage, pour 20 €.",
            "Le tirage d'une offre payante attend la confirmation du paiement. Les participants ne sont jamais débités.",
          ],
        },
        {
          title: "Organiser plusieurs services",
          paragraphs: [
            "Importez la liste, puis posez des exclusions : deux personnes précises, une exclusion réciproque, ou un groupe qui ne doit pas se tirer au sort. Si une contrainte rend le tirage impossible, rien n'est publié.",
            "Les souhaits et la messagerie anonyme restent disponibles. Les e-mails d'invitation ne contiennent pas le nom du destinataire.",
          ],
        },
        {
          title: "Ce que réservent les 39,90 €",
          paragraphs: [
            "Entreprise Plus ajoute les coorganisateurs et le suivi de progression par équipe, après paiement. Les coorganisateurs ne consultent pas les attributions secrètes.",
            "Le logo et les objets d'e-mail personnalisés sont disponibles pour Association, Entreprise et Entreprise Plus une fois le paiement confirmé. Au-delà de 300 personnes, enregistrez une demande : aucun paiement automatique n'est lancé.",
          ],
        },
      ]}
      faq={faq}
    />
  );
}
