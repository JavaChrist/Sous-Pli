import type { ReactNode } from "react";
import Link from "next/link";
import { CATALOG, billingPolicy, formatEuros, type OfferId } from "@shared/billing";
import { hosting, mediator, processors, publisher } from "@shared/publisher";

const PERIOD = "la préparation de l'événement et les douze mois suivant sa date";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-4xl text-pine-deep">{title}</h1>
      {children}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl text-pine-deep">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-ink">{children}</div>
    </section>
  );
}

export function MentionsDocument() {
  return (
    <Shell title="Mentions légales">
      <Section title="Éditeur">
        <p>{publisher.appName}, accessible à l'adresse {publisher.publicUrl}, est édité par {publisher.editorName}, {publisher.legalForm}, exerçant sous le nom commercial {publisher.tradeName}.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Adresse : {publisher.address}.</li>
          <li>Immatriculation : {publisher.registration}.</li>
          <li>SIREN : {publisher.siren}.</li>
          <li>SIRET : {publisher.siret}.</li>
          <li>Téléphone : {publisher.phone}.</li>
          <li>Contact : {publisher.email}.</li>
          <li>Directeur de la publication : {publisher.publicationDirector}.</li>
        </ul>
        <p>{publisher.taxMention}. Aucun numéro de TVA intracommunautaire n'est utilisé.</p>
      </Section>
      <Section title="Hébergement et nom de domaine">
        <p>L'application est hébergée par {hosting.application.name}, {hosting.application.address}. Site : {hosting.application.site}.</p>
        <p>Le nom de domaine souspli.fr est géré par {hosting.domain.name}, {hosting.domain.address}. Téléphone : {hosting.domain.phone}. Site : {hosting.domain.site}. IONOS gère le nom de domaine et n'héberge pas l'application.</p>
        <p>Le code source n'est pas l'hébergement du site public.</p>
      </Section>
      <Section title="Prestataires techniques">
        <p>{processors.firebase}</p>
        <p>E-mails transactionnels : {processors.resend.name}, {processors.resend.address}, {processors.resend.site}. Sans clé d'envoi configurée, les messages sont conservés localement et ne partent pas.</p>
        <p>Deux circuits encaissent, selon l'endroit où la commande est ouverte. Navigateur : {processors.mollie.name}, {processors.mollie.address}, registre néerlandais {processors.mollie.register}, {processors.mollie.site}. Application Android : Google Play Billing. Les numéros de carte et les coordonnées bancaires ne sont pas saisis ni stockés dans Sous pli.</p>
      </Section>
      <Section title="Propriété intellectuelle">
        <p>Les textes, la présentation, l'identité visuelle et le code de Sous pli sont protégés dans les conditions de la loi. Sous pli n'est pas présenté comme une marque déposée. Les utilisateurs conservent leurs droits sur leurs contenus. L'usage du service ne transfère aucun droit de propriété intellectuelle.</p>
      </Section>
      <Section title="Contact">
        <p>Pour une question ou un signalement, écrire à {publisher.email} en indiquant l'événement concerné. Ne transmettez ni mot de passe, ni code d'accès, ni donnée bancaire.</p>
      </Section>
    </Shell>
  );
}

export function PrivacyDocument() {
  return (
    <Shell title="Politique de confidentialité">
      <Section title="1. Responsable">
        <p>{publisher.editorName}, {publisher.legalForm} sous le nom {publisher.tradeName}, est responsable des traitements qu'il détermine pour les comptes, la sécurité, le support et la relation commerciale. Contact : {publisher.email}. Coordonnées complètes : page Mentions.</p>
        <p>Pour un événement d'entreprise ou d'association, l'organisation peut être responsable des données de ses participants et JavaChrist intervenir comme sous-traitant, sur instruction. Les conditions générales ne remplacent pas l'annexe de sous-traitance, proposée à part.</p>
      </Section>
      <Section title="2. Données traitées">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte et authentification : identifiant, nom affiché, e-mail, données de connexion.</li>
          <li>Invitations et inscriptions, y compris lorsqu'un organisateur communique une adresse.</li>
          <li>Événement, groupes, exclusions et attributions.</li>
          <li>Souhaits et liens HTTPS. La photo d'un souhait est facultative : elle part seulement si la personne la choisit. Elle n'est conservée que lorsque le stockage l'accepte. Une photo conservée n'est visible que par son auteur, l'organisateur et, lorsque l'identité est montrée, la personne qui l'a tirée.</li>
          <li>Messages dans l'application, signalements et blocages. Aucun outil ne relit ni ne filtre ces messages.</li>
          <li>Notifications internes.</li>
          <li>E-mails du service : destinataire, objet, expéditeur et contenu envoyé. L'organisateur peut enregistrer une introduction, une signature et, sur une offre payée qui l'inclut, l'objet et un logo. Ces éléments sont conservés et repris dans les envois. Le texte d'un message anonyme n'y est pas recopié.</li>
          <li>Achat lié à un événement : commande, produit, vérification, droit ouvert et remboursement. Le droit payé vaut sur le web et dans l'application Android. Aucune facture numérotée n'est émise. Aucune donnée de carte ni de compte bancaire n'est enregistrée.</li>
          <li>Données techniques et stockage local nécessaires à la connexion et à l'application installable.</li>
        </ul>
        <p>Les champs nécessaires sont indiqués dans les formulaires. Évitez d'y placer des informations sensibles inutiles.</p>
      </Section>
      <Section title="3. Qui voit quoi">
        <p>Les participants voient ce que le mode de l'événement leur ouvre : leur résultat, les souhaits utiles à leur cadeau, et la messagerie après tirage ou révélation. En mode classique et double mystère, l'identité affichée est masquée selon le mode. Elle est visible en mode public et après la révélation collective.</p>
        <p>L'organisateur voit les informations utiles à la gestion et au suivi. Il ne dispose pas, à lui seul, d'un droit de lecture des conversations ou des résultats secrets. Les coorganisateurs d'Entreprise Plus ne voient pas les attributions secrètes.</p>
        <p>Des personnes habilitées au support, à la sécurité ou à une obligation légale peuvent accéder à certaines données, de façon limitée. Il n'y a pas de modération automatique des conversations. Le signalement conserve l'identifiant de la conversation et celui de la personne qui signale, puis prévient l'organisateur sans le texte et sans les identités. Le blocage empêche seulement la personne qui l'a activé d'envoyer un nouveau message dans cette conversation. Ces actions ne transmettent pas le message à une équipe pour qu'elle le modère. L'affichage masqué n'est pas un chiffrement de bout en bout et ne promet pas un anonymat absolu : un texte peut permettre de reconnaître une personne.</p>
        <p>Les messages ne sont pas recopiés dans les notifications ni dans les e-mails d'alerte. Il n'y a pas de pièce jointe dans la messagerie. Le plafond est de vingt messages par dix minutes.</p>
      </Section>
      <Section title="4. Bases">
        <p>L'exécution du service et des mesures précontractuelles, les obligations légales, l'intérêt légitime à la sécurité et à la défense des droits, et le consentement lorsqu'il est requis. L'acceptation des conditions générales n'est pas un consentement général aux traitements ni à la prospection. Aucune prospection n'est déclenchée par une invitation.</p>
      </Section>
      <Section title="5. Prestataires et transferts">
        <p>{processors.firebase} L'authentification Firebase est exécutée uniquement depuis des centres situés aux États-Unis. Les fonctions sont prévues en europe-west1. La région de la base et des fichiers est celle du projet. Cela ne signifie pas que toutes les données restent dans l'Union européenne.</p>
        <p>Hébergement de l'application : {hosting.application.name}, {hosting.application.address}. Nom de domaine : {hosting.domain.name}, qui n'héberge pas l'application.</p>
        <p>E-mails : {processors.resend.name}, {processors.resend.address}. Ce prestataire figure au Data Privacy Framework sous le nom Plus Five Five. Il reçoit le destinataire, l'objet et le contenu de l'e-mail, pour l'envoyer. Paiement dans le navigateur : {processors.mollie.name}, {processors.mollie.address}. Paiement dans l'application Android : Google Play Billing. Google reçoit la commande nécessaire à l'encaissement et à la vérification. Sous pli ne lui transmet ni numéro de carte ni coordonnées bancaires. Les garanties de transfert sont celles des contrats conclus avec ces prestataires. Aucun outil de mesure d'audience ni notification push du système n'est activé.</p>
      </Section>
      <Section title="6. Durées">
        <p>L'accès à un événement dure pendant sa préparation et jusqu'à douze mois après sa date, dans le fuseau de l'événement. Un avertissement est prévu trente jours avant la suppression. Un report de date ne repousse pas la fin d'accès déjà fixée. Le maintien du compte ne prolonge pas les messages.</p>
        <p>Le lien d'invitation vaut trente jours. Les données du jeton d'invitation sont supprimées soixante jours après son expiration. Un brouillon sans activité est signalé après cinq mois et supprimé après six mois. Un compte sans connexion est signalé après vingt-quatre mois, puis supprimé après trente jours sans reprise, sauf échange encore organisé par la personne.</p>
        <p>Les journaux de sécurité sont visés pour six mois. Le corps HTML de l'e-mail et le lien secret d'envoi sont retirés après l'envoi. L'introduction, la signature, l'objet personnalisé et les métadonnées d'envoi peuvent rester : les métadonnées sont visées pour quatre-vingt-dix jours, le thème d'e-mail reste avec l'événement.</p>
        <p>Les achats sont conservés à part. Pour une commande, Sous pli garde l'événement, l'offre, le montant, la devise, l'état, la référence du prestataire et la version des conditions. Pour Google Play, il garde aussi le produit, le jeton d'achat, son empreinte, l'identifiant opaque du compte, le résultat de la vérification et l'état de consommation. Le droit ouvert sur l'événement comprend l'offre payée, le montant et la fin d'accès. Le remboursement garde son état. Ces pièces servent à exécuter la commande, vérifier l'achat, ouvrir le droit et traiter un remboursement. La règle prévue vise une conservation comptable de dix ans. Aucun traitement ne les efface à cette échéance, et la suppression du compte ne les retire pas. Elles ne sont pas une facture.</p>
        <p>Ces durées décrivent le sort prévu des données. Le traitement planifié fonctionne en simulation tant qu'il n'est pas activé : il liste les éléments arrivés à échéance et ne les supprime pas. Aucun délai de purge des sauvegardes du fournisseur n'est annoncé. Une restauration pourrait réintroduire des données effacées. Après suppression d'un compte d'authentification, Firebase indique retirer les données d'authentification des systèmes actifs et de sauvegarde dans un délai de cent quatre-vingts jours.</p>
      </Section>
      <Section title="7. Suppression de compte">
        <p>La suppression retire le profil, le compte d'authentification, les index de participation, les souhaits et fichiers associés, les jetons et codes liés, les notifications, les copies de messages détenues par la personne et les envois en attente devenus inutiles. Les messages déjà reçus par un correspondant peuvent rester chez lui jusqu'à la fin de l'événement, sans lien vers le compte supprimé. Leur texte peut encore permettre une reconnaissance : le seul retrait de l'identifiant ne les anonymise pas.</p>
        <p>Un échange encore en cours dont la personne est organisatrice doit être annulé ou archivé avant la suppression. L'événement des autres participants n'est pas effacé avec le compte. Les pièces de paiement restent conservées à part.</p>
        <p>Le parcours dans l'application et la demande par e-mail sont décrits sur la page <Link href="/suppression-compte" className="text-pine underline">Suppression de compte</Link>.</p>
      </Section>
      <Section title="8. Stockage local">
        <ul className="list-disc space-y-1 pl-5">
          <li>Persistance de connexion Firebase dans le navigateur, jusqu'à la déconnexion.</li>
          <li>Brouillon d'événement dans le stockage local, retiré à l'enregistrement ou à l'effacement du brouillon.</li>
          <li>Cache de l'application installable, limité aux fichiers statiques et à la page hors ligne.</li>
          <li>Sauvegarde Android du système, lorsque la personne l'a activée sur son appareil. L'application l'autorise. Elle peut comprendre la session locale. Sous pli n'en fait pas une copie supplémentaire.</li>
        </ul>
        <p>Les notifications se consultent dans l'application. Les notifications push du système ne sont pas activées. Aucun identifiant publicitaire ni identifiant d'installation Firebase n'est collecté par l'application Android.</p>
      </Section>
      <Section title="9. Droits">
        <p>Vous pouvez demander l'accès, la rectification, l'effacement, la limitation, la portabilité et l'opposition aux traitements fondés sur l'intérêt légitime, ainsi que le retrait d'un consentement lorsqu'un traitement en repose sur un. Écrivez à {publisher.email}. Une vérification proportionnée peut être demandée. La réponse intervient en principe dans un mois, prolongeable de deux mois en cas de complexité, avec information dans le premier mois.</p>
        <p>Vous pouvez introduire une réclamation auprès de la CNIL : https://www.cnil.fr/fr/plaintes.</p>
      </Section>
    </Shell>
  );
}

export function TermsDocument() {
  const rows: OfferId[] = ["family", "association", "business", "business_plus", "quote"];
  return (
    <Shell title="Conditions générales d'utilisation et de vente">
      <Section title="1. Objet">
        <p>Sous pli est un service d'organisation d'échanges de cadeaux édité par {publisher.editorName}, {publisher.legalForm}, nom commercial {publisher.tradeName}. Contact : {publisher.email}. Le service n'est ni le vendeur ni le transporteur des cadeaux. Il ne collecte pas leur budget et ne garantit pas qu'un cadeau sera acheté ou remis.</p>
      </Section>
      <Section title="2. Acceptation">
        <p>Les conditions sont accessibles avant la création du compte et avant une commande. L'acceptation se fait par une case non précochée et la version acceptée est conservée avec la commande. Elle ne vaut pas consentement général aux traitements ni à la prospection. La politique de confidentialité se consulte séparément.</p>
        <p>L'organisateur doit être majeur, ou disposer du pouvoir d'engager la structure pour laquelle il agit. La participation d'un mineur relève de son représentant légal.</p>
      </Section>
      <Section title="3. Comptes, tirage et contenus">
        <p>Chacun protège son compte et ses liens privés. Un organisateur n'invite que des personnes concernées par l'événement. Les invitations ne servent pas à la prospection. L'expiration d'un lien n'efface pas immédiatement toutes les données.</p>
        <p>Le tirage est une action séparée du paiement. Il n'est pas relancé par une nouvelle consultation. Les modes classique, public et double mystère sont décrits avant le lancement. Le masquage d'identité n'est pas un chiffrement de bout en bout.</p>
        <p>Les contenus illicites, le harcèlement, l'usurpation et le contournement des accès sont interdits. Un souhait n'est pas une commande. Le signalement et le blocage sont disponibles.</p>
      </Section>
      <Section title="4. Prix">
        <p>{billingPolicy.promise} {billingPolicy.taxNote}</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-semibold">Offre</th>
              <th className="py-2 pr-3 font-semibold">Prix final</th>
              <th className="py-2 font-semibold">Capacité</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((id) => (
              <tr key={id} className="border-b border-line/70">
                <td className="py-2 pr-3">{CATALOG[id].title}</td>
                <td className="py-2 pr-3">{CATALOG[id].priceCents === null ? "Sur devis" : CATALOG[id].priceCents === 0 ? "Gratuit" : formatEuros(CATALOG[id].priceCents)}</td>
                <td className="py-2">{CATALOG[id].capacity ? `${CATALOG[id].capacity} participants` : "Plus de 300"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Seul l'organisateur paie. Avant le tirage, le passage d'Entreprise à Entreprise Plus coûte 20 €. La duplication d'un événement ne transfère pas les droits payés. Les fonctions de chaque offre sont celles décrites sur la page Tarifs. Les notifications push du système ne font pas partie des fonctions vendues. La photo d'un souhait n'est pas réservée à une offre payante. Sa visibilité est celle décrite dans la politique de confidentialité.</p>
      </Section>
      <Section title="5. Commande et durée">
        <p>Le prix, la capacité et la fin d'accès sont fixés par le serveur et rappelés avant la commande, avec la version des conditions. Le retour du navigateur ou de l'application ne débloque pas l'offre : le serveur vérifie l'achat. Aucune donnée de carte n'est stockée. Un paiement échoué, annulé ou expiré laisse l'événement en place. Le paiement ne lance pas le tirage.</p>
        <p>L'accès court pendant la préparation et jusqu'à douze mois après la date de l'événement, dans son fuseau. Cette fin est conservée avec la commande. Un report ne la repousse pas. L'archivage n'est pas une conservation illimitée.</p>
        <p>Dans le navigateur, le paiement est encaissé par Mollie. Dans l'application Android, il est encaissé par Google Play Billing. Le droit est enregistré sur l'événement et reste utilisable avec le même compte sur le web et dans l'application. {billingPolicy.invoiceNote} Le reçu du circuit utilisé n'est pas non plus une facture de JavaChrist.</p>
      </Section>
      <Section title="6. Rétractation">
        <p>{billingPolicy.withdrawalNote}</p>
        <p>La demande peut être faite depuis l'espace de la commande ou par e-mail à {publisher.email}, avec la date et la référence. Le délai de quatorze jours part de la confirmation du paiement. Pour un achat Google Play, le remboursement se confirme dans Google Play et aucune demande n'est envoyée à Mollie. Pour un paiement Mollie, le remboursement est envoyé à Mollie par une personne habilitée, une seule fois pour une même commande, puis confirmé par l'état réel du paiement. Un e-mail part après cette confirmation. Les options payantes de la commande cessent. Les attributions déjà réalisées ne sont pas redistribuées.</p>
        <h3 className="font-serif text-xl">Formulaire de rétractation</h3>
        <p>À l'attention de {publisher.editorName}, {publisher.legalForm} — {publisher.tradeName}, {publisher.address} — {publisher.email}.</p>
        <p>Je vous notifie ma rétractation du contrat portant sur l'événement et l'offre suivants :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Événement et référence de commande :</li>
          <li>Offre :</li>
          <li>Date de commande :</li>
          <li>Nom du client :</li>
          <li>Adresse du client :</li>
          <li>Adresse e-mail associée à la commande :</li>
          <li>Date :</li>
          <li>Signature, uniquement en cas d'envoi papier.</li>
        </ul>
      </Section>
      <Section title="7. Garantie légale">
        <p>Le service numérique est fourni de manière continue pendant la période contractuelle de l'événement. L'encadré ci-dessous reprend le modèle annexé à l'article D. 211-4 du code de la consommation. La mention de période remplace le signe prévu par ce modèle.</p>
        <aside className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <p>Le consommateur a droit à la mise en œuvre de la garantie légale de conformité en cas d'apparition d'un défaut de conformité durant un délai de {PERIOD} à compter de la fourniture du contenu numérique ou du service numérique. Durant ce délai, le consommateur n'est tenu d'établir que l'existence du défaut de conformité et non la date d'apparition de celui-ci.</p>
          <p>La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du contenu numérique ou du service numérique durant {PERIOD}.</p>
          <p>La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique ou du service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.</p>
          <p>Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique ou le service numérique, ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au contenu numérique ou au service numérique, si :</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Le professionnel refuse de mettre le contenu numérique ou le service numérique en conformité ;</li>
            <li>La mise en conformité du contenu numérique ou du service numérique est retardée de manière injustifiée ;</li>
            <li>La mise en conformité du contenu numérique ou du service numérique ne peut intervenir sans frais imposés au consommateur ;</li>
            <li>La mise en conformité du contenu numérique ou du service numérique occasionne un inconvénient majeur pour le consommateur ;</li>
            <li>La non-conformité du contenu numérique ou du service numérique persiste en dépit de la tentative de mise en conformité du professionnel restée infructueuse.</li>
          </ol>
          <p>Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de conformité est si grave qu'il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n'est alors pas tenu de demander la mise en conformité du contenu numérique ou du service numérique au préalable.</p>
          <p>Dans les cas où le défaut de conformité est mineur, le consommateur n'a droit à l'annulation du contrat que si le contrat ne prévoit pas le paiement d'un prix.</p>
          <p>Toute période d'indisponibilité du contenu numérique ou du service numérique en vue de sa remise en conformité suspend la garantie qui restait à courir jusqu'à la fourniture du contenu numérique ou du service numérique de nouveau conforme.</p>
          <p>Ces droits résultent de l'application des articles L. 224-25-1 à L. 224-25-31 du code de la consommation.</p>
          <p>Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d'un montant maximal de 300 000 euros, qui peut être porté jusqu'à 10 % du chiffre d'affaires moyen annuel (article L. 242-18-1 du code de la consommation).</p>
          <p>Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le contenu numérique ou le service numérique est conservé, ou à un remboursement intégral contre renonciation au contenu numérique ou au service numérique.</p>
        </aside>
        <p>Aucune clause n'écarte ces garanties. Aucun plafond symbolique de responsabilité et aucune compétence exclusive au siège de JavaChrist ne sont imposés au consommateur.</p>
      </Section>
      <Section title="8. Médiation">
        <p>Pour une réclamation : {publisher.email}. Après une réclamation écrite restée sans solution, le consommateur peut saisir gratuitement {mediator.name}, {mediator.address}. Site et saisine : {mediator.site}. Ce recours concerne les litiges de consommation. Il ne s'applique pas aux litiges entre professionnels. La plateforme européenne de règlement en ligne des litiges n'est pas proposée : elle a fermé.</p>
        <p>Les conditions sont soumises au droit français, sous réserve des règles impératives protectrices du consommateur. Les juridictions compétentes sont celles que la loi désigne.</p>
      </Section>
    </Shell>
  );
}

export function ProcessingAnnex() {
  return (
    <Shell title="Annexe de sous-traitance">
      <Section title="Quand elle s'applique">
        <p>Cette annexe s'applique lorsqu'une entreprise ou une association, responsable de traitement, fait traiter par {publisher.tradeName} les données de ses participants pour un événement Sous pli. Elle ne remplace pas les conditions générales et ne constitue pas un consentement des personnes à la prospection.</p>
        <p>Version {publisher.processingAnnexVersion}. Contact : {publisher.email}.</p>
      </Section>
      <Section title="Instructions et données">
        <p>JavaChrist traite les comptes nécessaires, les invitations, l'événement, les groupes, les exclusions, les attributions, les souhaits, les messages, les signalements, les notifications internes, les e-mails transactionnels et les références de commande, uniquement pour fournir l'événement demandé.</p>
        <p>Les personnes voient les informations selon le mode choisi. Les personnes habilitées au support et à la sécurité y accèdent de façon limitée. Il n'y a pas de chiffrement de bout en bout ni d'anonymat absolu.</p>
      </Section>
      <Section title="Sous-traitants ultérieurs">
        <p>{processors.firebase} Hébergement de l'application : {hosting.application.name}. E-mails : {processors.resend.name}. Paiement dans le navigateur : {processors.mollie.name}. Paiement dans l'application Android : Google Play Billing. Le nom de domaine est géré par {hosting.domain.name}, qui n'héberge pas l'application.</p>
        <p>L'authentification Firebase est traitée aux États-Unis. Les autres traitements ne sont pas présentés comme exclusivement européens. Les transferts reposent sur les contrats de ces prestataires.</p>
      </Section>
      <Section title="Fin de traitement">
        <p>À la fin d'accès de l'événement, les données de l'événement sont destinées à être supprimées, sauf enregistrements de paiement conservés à part. L'organisation peut demander l'aide de JavaChrist pour répondre aux droits des personnes, à {publisher.email}. JavaChrist n'utilise pas ces données pour son propre démarchage.</p>
      </Section>
    </Shell>
  );
}

export function DeletionRequestDocument() {
  return (
    <Shell title="Suppression de compte">
      <Section title="Sous pli">
        <p>Cette page explique comment demander la suppression d'un compte Sous pli, sans réinstaller l'application et sans être connecté.</p>
        <p>Depuis une session ouverte, le parcours est : Profil, puis Supprimer le compte. Il faut saisir SUPPRIMER. L'application n'envoie pas cette confirmation à votre place.</p>
        <p>Sans ouvrir l'application, écrivez à <a className="text-pine underline" href={`mailto:${publisher.email}`}>{publisher.email}</a> depuis l'adresse du compte, en demandant la suppression. Le support peut demander une vérification proportionnée. Cette page n'efface rien automatiquement.</p>
      </Section>
      <Section title="Échanges encore actifs">
        <p>Si vous organisez encore un échange en préparation, tiré ou révélé, la suppression du compte est refusée. Il faut d'abord annuler ou archiver cet échange. Les échanges des autres participants ne sont pas supprimés avec votre compte, et ils ne sont pas annulés à votre place.</p>
        <p>Pour ces situations, écrivez à <a className="text-pine underline" href={`mailto:${publisher.email}`}>{publisher.email}</a>. L'assistance peut vous indiquer comment clôturer l'échange. Elle ne le supprime pas depuis cette page.</p>
      </Section>
      <Section title="Ce qui est retiré">
        <p>Quand la suppression aboutit, le profil, le compte d'authentification, les index de participation, les souhaits et les fichiers associés, les jetons et codes liés à la personne, les notifications, les copies de messages qu'elle détient et les e-mails encore en attente sont retirés.</p>
      </Section>
      <Section title="Ce qui est anonymisé ou conservé">
        <p>Après un tirage, ou si l'échange est déjà clos, le nom du participant devient « Participant retiré » et son adresse est vidée. Les messages déjà reçus par un correspondant restent chez lui, sans lien vers le compte supprimé. Leur texte peut encore permettre de reconnaître une personne : ce n'est pas une anonymisation complète.</p>
        <p>Les pièces de paiement restent conservées à part. Elles ne sont pas effacées avec le compte et ne constituent pas une facture. La règle prévue vise une conservation comptable de dix ans. Cette page ne promet pas qu'elles disparaissent automatiquement à cette échéance.</p>
      </Section>
      <p className="text-sm">
        <Link href="/profil" className="text-pine underline">Ouvrir le profil</Link>
        {" · "}
        <Link href="/confidentialite" className="text-pine underline">Confidentialité</Link>
        {" · "}
        <Link href="/contact" className="text-pine underline">Contact</Link>
      </p>
    </Shell>
  );
}
