import { GuideArticle } from "@/components/pages/guides";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Tirage au sort pour une association",
  description: "Un échange de cadeaux associatif, jusqu'à 100 personnes, payé une fois 9,90 € par l'organisateur. Les participants ne paient rien.",
  path: "/association",
});

const faq = [
  {
    q: "Quel est le prix pour une association ?",
    a: "9,90 € pour un événement, jusqu'à 100 participants. C'est le montant final affiché. Il n'y a pas d'abonnement, et les participants ne paient pas.",
  },
  {
    q: "Le statut associatif est-il vérifié ?",
    a: "Non. Le contexte déclaré oriente l'offre. Il n'est pas contrôlé automatiquement.",
  },
  {
    q: "Peut-on ajouter le logo de l'association ?",
    a: "Oui, sur l'événement et dans les e-mails, une fois le paiement confirmé. Les objets d'e-mail sont alors personnalisables.",
  },
];

export default function Page() {
  return (
    <GuideArticle
      eyebrow="Association"
      title="Tirage au sort de cadeaux pour une association"
      lead="Pour un club, une amicale ou une association, l'organisateur règle une fois l'événement. Le tirage, les souhaits et les messages anonymes fonctionnent comme pour une famille, jusqu'à 100 personnes."
      sections={[
        {
          title: "Ce qui est inclus",
          paragraphs: [
            "L'offre Association reprend les fonctions de Famille & amis : tirage secret, exclusions individuelles, réciproques ou par groupe, import d'un tableau, relances, listes de souhaits et messagerie anonyme.",
            "Les invitations partent par e-mail ou par lien privé. Aucun nom tiré au sort n'est placé dans ces messages.",
          ],
        },
        {
          title: "Après le paiement",
          paragraphs: [
            "Le logo de l'événement et les objets d'e-mail personnalisés deviennent disponibles une fois le paiement confirmé. Avant cette confirmation, le tirage ne s'ouvre pas pour une offre payante.",
            "Le paiement se fait par l'organisateur. Les membres de l'association ne règlent rien. Le prix affiché sur la page Tarifs est le montant final.",
          ],
        },
        {
          title: "Ce que cette offre ne fait pas",
          paragraphs: [
            "Elle ne vérifie pas que vous représentez une association. Elle ne crée pas non plus une facture numérotée : l'e-mail de confirmation est un reçu de commande.",
            "Au-delà de 100 personnes, il faut passer à l'offre Entreprise Plus, jusqu'à 300 participants, ou demander un devis sans débit automatique.",
          ],
        },
      ]}
      faq={faq}
    />
  );
}
