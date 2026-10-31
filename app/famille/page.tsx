import { GuideArticle } from "@/components/pages/guides";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Secret Santa en famille",
  description: "Organisez un Père Noël secret gratuit, jusqu'à 50 personnes. Le tirage reste caché et chacun découvre son destinataire sous pli.",
  path: "/famille",
});

const faq = [
  {
    q: "Le Secret Santa familial est-il gratuit ?",
    a: "Oui. L'offre Famille & amis coûte 0 €, pour un événement, jusqu'à 50 participants. Les invités ne paient jamais.",
  },
  {
    q: "Un enfant peut-il participer ?",
    a: "Oui, par l'intermédiaire d'un adulte responsable. Cet adulte peut connaître le tirage de l'enfant : ce n'est pas un secret vis-à-vis de lui.",
  },
  {
    q: "L'organisateur voit-il qui offre à qui ?",
    a: "En mode secret, non. Il suit les invitations, les consultations et les souhaits, pas les paires.",
  },
];

export default function Page() {
  return (
    <GuideArticle
      eyebrow="Famille et amis"
      title="Organiser un Secret Santa en famille"
      lead="Préparez le tirage au sort de Noël sans révéler les paires. L'offre familiale est gratuite, jusqu'à 50 personnes, et le résultat se consulte dans un espace protégé."
      sections={[
        {
          title: "Préparer le groupe",
          paragraphs: [
            "Donnez un nom à l'échange, une date, une heure et un budget. Ajoutez la famille à la main ou depuis un tableau. Deux personnes ne peuvent pas partager la même adresse.",
            "Vous pouvez exclure certaines paires, par exemple deux conjoints, ou écarter un groupe entier. Ces règles sont prises en compte avant la publication du tirage.",
          ],
        },
        {
          title: "Inviter sans dévoiler le résultat",
          paragraphs: [
            "Chaque personne reçoit un lien personnel ou un e-mail. Le message ne contient pas le nom du destinataire. Le résultat se lit après ouverture de l'espace protégé.",
            "Un participant peut rejoindre par le lien, puis sécuriser sa session. L'installation sur l'écran d'accueil est proposée, jamais imposée.",
          ],
        },
        {
          title: "Souhaits, messages et révélation",
          paragraphs: [
            "Chacun peut laisser une liste de souhaits. Les messages entre le tireur et son destinataire restent anonymes jusqu'à la révélation que vous ouvrez, à l'heure prévue dans le fuseau de l'échange.",
            "Si le tirage est impossible, par exemple parce qu'une personne n'a plus assez de destinataires, rien n'est publié. Vous recevez une explication.",
          ],
        },
      ]}
      faq={faq}
    />
  );
}
