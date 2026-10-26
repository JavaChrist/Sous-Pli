import type { ContextKind, Occasion } from "../domain";

export const TEMPLATE_IDS = [
  "invitation",
  "draw_ready",
  "invite_resent",
  "reminder_view",
  "reminder_wishes",
  "new_message",
  "info_changed",
  "reminder_event",
  "reveal_available",
  "cancellation",
  "payment_confirmed",
  "payment_failed",
  "offer_changed",
  "refund_confirmed",
  "withdrawal_requested",
  "retention_warning",
  "draft_warning",
  "account_inactive",
  "password_reset",
  "email_verification",
  "email_change",
  "email_change_notice",
  "account_deleted",
] as const;

export const SERVICE_TEMPLATE_IDS = [
  "payment_confirmed",
  "payment_failed",
  "offer_changed",
  "refund_confirmed",
  "withdrawal_requested",
  "retention_warning",
  "draft_warning",
  "account_inactive",
  "password_reset",
  "email_verification",
  "email_change",
  "email_change_notice",
  "account_deleted",
] as const;

export const EVENT_TEMPLATE_IDS = TEMPLATE_IDS.filter(
  (id) => !(SERVICE_TEMPLATE_IDS as readonly string[]).includes(id),
);

export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const TEMPLATE_VERSION = 1;

export type Tone = "tu" | "vous";
export type PaletteId = "sapin" | "bordeaux" | "soiree" | "sobre";

export const PALETTES: Record<PaletteId, { background: string; primary: string; accent: string; text: string }> = {
  sapin: { background: "#F4EFE6", primary: "#1B4332", accent: "#A6843D", text: "#1C1917" },
  bordeaux: { background: "#F8F1F2", primary: "#7A2433", accent: "#1B4332", text: "#1C1917" },
  soiree: { background: "#F6F3EE", primary: "#243044", accent: "#A6843D", text: "#1C1917" },
  sobre: { background: "#F4F6F5", primary: "#1F3A32", accent: "#5E6E68", text: "#1C1917" },
};

export interface EmailTheme {
  context: ContextKind;
  occasion: Occasion;
  identity: "event" | "service";
  palette: PaletteId;
  tone: Tone;
  fromName: string;
  organizationName: string;
  teamName: string;
  logoUrl: string;
  intro: string;
  instructions: string;
  buttonLabel: string;
  signature: string;
  replyToEnabled: boolean;
  subjectOverrides: Partial<Record<TemplateId, string>>;
}

export interface TemplateCopy {
  subject: string;
  preheader: string;
  paragraphs: string[];
  button: string;
}

const ESSENTIAL = new Set<TemplateId>([
  "invitation",
  "invite_resent",
  "draw_ready",
  "cancellation",
  "reveal_available",
  "payment_confirmed",
  "payment_failed",
  "offer_changed",
  "refund_confirmed",
  "withdrawal_requested",
  "retention_warning",
  "draft_warning",
  "account_inactive",
]);
const ACTIVITY = new Set<TemplateId>(["new_message", "info_changed"]);

export function templateChannel(id: TemplateId): "essential" | "reminder" | "activity" {
  if (ESSENTIAL.has(id)) return "essential";
  if (ACTIVITY.has(id)) return "activity";
  return "reminder";
}

export function defaultTheme(context: ContextKind, occasion: Occasion): EmailTheme {
  const palette: PaletteId =
    context === "organization" ? "sobre" : context === "friends" ? "soiree" : occasion === "christmas" ? "sapin" : "bordeaux";
  return {
    context,
    occasion,
    identity: "event",
    palette,
    tone: context === "organization" ? "vous" : "tu",
    fromName: "",
    organizationName: "",
    teamName: "",
    logoUrl: "",
    intro: "",
    instructions: "",
    buttonLabel: "",
    signature: "",
    replyToEnabled: false,
    subjectOverrides: {},
  };
}

/** Identité Sous pli, sans thème familial ni palette de Noël. */
export function serviceTheme(): EmailTheme {
  return {
    ...defaultTheme("family", "other"),
    identity: "service",
    palette: "sobre",
    tone: "vous",
    fromName: "Sous pli",
  };
}

type Bundle = Record<TemplateId, TemplateCopy>;

function bundle(tone: Tone, context: ContextKind): Bundle {
  const your = tone === "tu" ? "ton" : "votre";
  const open = tone === "tu" ? "Ouvre" : "Ouvrez";
  const discover = tone === "tu" ? "Découvre" : "Découvrez";
  const family = context === "family";
  const org = context === "organization";
  const place = org ? "{{structure}}" : family ? "la famille" : "le groupe";
  return {
    invitation: {
      subject: org
        ? "{{prenom}}, invitation à l'échange {{evenement}}"
        : family
          ? tone === "tu"
            ? "{{prenom}}, une place t'attend pour {{evenement}}"
            : "{{prenom}}, une place vous est réservée pour {{evenement}}"
          : tone === "tu"
            ? "{{prenom}}, on compte sur toi pour {{evenement}}"
            : "{{prenom}}, nous comptons sur vous pour {{evenement}}",
      preheader: "Le résultat du tirage n'est pas dans ce message.",
      paragraphs: [
        org
          ? "{{organisateur}} vous invite à participer à l'échange {{evenement}}, organisé pour {{structure}}."
          : `{{organisateur}} t'invite à ${place} pour {{evenement}}.`,
        "Rendez-vous le {{date}} à {{heure}}. Lieu : {{lieu}}. Budget : {{budget}} {{devise}}.",
        "Consignes : {{regles}}",
        `${open} ton espace personnel pour accepter. Aucun nom tiré au sort ne figure ici.` .replace(
          "ton espace",
          tone === "tu" ? "ton espace" : "votre espace",
        ),
      ],
      button: tone === "tu" ? "Voir mon invitation" : "Répondre à l'invitation",
    },
    draw_ready: {
      subject: tone === "tu" ? "{{prenom}}, ton tirage est prêt" : "{{prenom}}, votre tirage est disponible",
      preheader: "Consultez le résultat dans l'espace protégé.",
      paragraphs: [
        `Le tirage de {{evenement}} est lancé. ${discover} ${your} destinataire uniquement après connexion.`,
        "Cet e-mail ne nomme personne. Les autres attributions restent privées, sauf si l'organisateur a choisi un mode public annoncé avant le tirage.",
      ],
      button: tone === "tu" ? "Découvrir dans mon espace" : "Consulter mon espace",
    },
    invite_resent: {
      subject: "{{prenom}}, nouvelle invitation pour {{evenement}}",
      preheader: "Le lien précédent ne fonctionne plus.",
      paragraphs: [
        tone === "tu"
          ? "{{organisateur}} t'envoie un nouveau lien pour {{evenement}}. L'ancien lien est révoqué."
          : "{{organisateur}} vous envoie un nouveau lien pour {{evenement}}. L'ancien lien est révoqué.",
        "Le message ne contient pas le résultat du tirage.",
      ],
      button: tone === "tu" ? "Ouvrir le nouveau lien" : "Ouvrir le nouveau lien",
    },
    reminder_view: {
      subject: tone === "tu" ? "{{prenom}}, ton résultat t'attend" : "{{prenom}}, votre résultat vous attend",
      preheader: "Rappel de consultation, sans révéler le tirage.",
      paragraphs: [
        `Tu n'as pas encore ouvert ton résultat pour {{evenement}}.` .replace(
          "Tu n'as pas encore ouvert ton",
          tone === "tu" ? "Tu n'as pas encore ouvert ton" : "Vous n'avez pas encore ouvert votre",
        ),
        `${open} l'espace protégé. Ce rappel ne dit pas à qui offrir le cadeau.`,
      ],
      button: "Consulter le résultat",
    },
    reminder_wishes: {
      subject: tone === "tu" ? "{{prenom}}, tes idées de cadeaux" : "{{prenom}}, vos idées de cadeaux",
      preheader: "Une liste aide la personne qui vous offre un cadeau.",
      paragraphs: [
        tone === "tu"
          ? "Tu peux indiquer quelques idées pour {{evenement}}, un lien HTTPS, une taille ou ce qu'il vaut mieux éviter."
          : "Vous pouvez indiquer quelques idées pour {{evenement}}, un lien HTTPS, une taille ou ce qu'il vaut mieux éviter.",
        "N'ajoute pas d'information sensible inutile.",
      ],
      button: tone === "tu" ? "Compléter mes souhaits" : "Compléter mes souhaits",
    },
    new_message: {
      subject: `{{prenom}}, un message vous attend`,
      preheader: "Notification sans contenu privé.",
      paragraphs: [
        `Un message est disponible dans ${your} espace pour {{evenement}}.`,
        "Ce courriel ne reprend ni le texte, ni l'identité cachée de la personne.",
      ],
      button: "Lire dans l'espace protégé",
    },
    info_changed: {
      subject: "{{evenement}} : informations mises à jour",
      preheader: "Le lieu, le budget ou les consignes ont changé.",
      paragraphs: [
        "{{organisateur}} a mis à jour les informations pratiques de {{evenement}}.",
        "Date : {{date}} à {{heure}}. Lieu : {{lieu}}. Budget : {{budget}} {{devise}}.",
        "Consignes : {{regles}}",
        "Les attributions déjà tirées ne changent pas.",
      ],
      button: "Voir les informations",
    },
    reminder_event: {
      subject: tone === "tu" ? "{{prenom}}, {{evenement}} approche" : "{{prenom}}, {{evenement}} approche",
      preheader: "Rappel avant la date prévue.",
      paragraphs: [
        `${place[0]?.toUpperCase()}${place.slice(1)} se retrouve le {{date}} à {{heure}}. Lieu : {{lieu}}.`,
        `Prépare ton cadeau dans le budget de {{budget}} {{devise}}.` .replace(
          "Prépare ton",
          tone === "tu" ? "Prépare ton" : "Préparez votre",
        ),
      ],
      button: "Revoir les consignes",
    },
    reveal_available: {
      subject: "{{prenom}}, la révélation de {{evenement}} est ouverte",
      preheader: "L'organisateur a autorisé la révélation collective.",
      paragraphs: [
        tone === "tu"
          ? "{{organisateur}} a ouvert la révélation collective de {{evenement}}. Tu peux regarder le bilan dans ton espace."
          : "{{organisateur}} a ouvert la révélation collective de {{evenement}}. Vous pouvez regarder le bilan dans votre espace.",
        "Ce message ne liste pas les attributions.",
      ],
      button: "Ouvrir le bilan",
    },
    cancellation: {
      subject: "{{evenement}} est annulé",
      preheader: "L'échange n'aura pas lieu.",
      paragraphs: [
        tone === "tu"
          ? "{{organisateur}} a annulé {{evenement}}. Les attributions ne sont plus à suivre."
          : "{{organisateur}} a annulé {{evenement}}. Les attributions ne sont plus à suivre.",
        "Aucune nouvelle invitation ne partira pour cet échange.",
      ],
      button: "Voir le message",
    },
    payment_confirmed: {
      subject: "Reçu de commande pour {{evenement}}",
      preheader: "Paiement confirmé. Le tirage n'est pas lancé par ce message.",
      paragraphs: [
        "Sous pli a enregistré le paiement de {{offre}} pour {{evenement}}.",
        "Montant : {{montant}} {{devise}}. Référence : {{reference}}. {{mention_fiscale}}.",
        "Ce message est un reçu de commande. Le reçu Mollie, s'il est émis, n'est pas la facture de JavaChrist. Aucune facture numérotée n'est jointe. Il ne contient aucune attribution secrète.",
        "Le tirage reste une action séparée, après vérification des exclusions.",
      ],
      button: "Revenir à l'événement",
    },
    payment_failed: {
      subject: "Paiement non abouti pour {{evenement}}",
      preheader: "Aucun déblocage n'a été appliqué.",
      paragraphs: [
        "Le paiement de {{offre}} pour {{evenement}} n'a pas abouti.",
        "Montant prévu : {{montant}} {{devise}}. Référence : {{reference}}.",
        "L'événement, ses participants et ses exclusions n'ont pas été modifiés. Vous pouvez reprendre le paiement.",
      ],
      button: "Reprendre le paiement",
    },
    offer_changed: {
      subject: "Changement d'offre pour {{evenement}}",
      preheader: "La différence annoncée a été confirmée.",
      paragraphs: [
        "Le passage à {{offre}} pour {{evenement}} est confirmé.",
        "Montant de ce changement : {{montant}} {{devise}}. Référence : {{reference}}.",
        "Ce reçu ne contient pas les attributions. Le tirage, s'il n'est pas encore lancé, reste à démarrer séparément.",
      ],
      button: "Revenir à l'événement",
    },
    refund_confirmed: {
      subject: "Remboursement confirmé pour {{evenement}}",
      preheader: "Le prestataire a confirmé le remboursement.",
      paragraphs: [
        "Un remboursement de {{montant}} {{devise}} a été confirmé pour {{offre}}, événement {{evenement}}.",
        "Référence : {{reference}}. Ce message n'est émis qu'après confirmation du remboursement, pas sur une simple demande.",
        "Les options payantes de cette commande cessent. Les attributions déjà réalisées ne sont pas redistribuées.",
        "Aucune attribution secrète n'est indiquée.",
      ],
      button: "Voir l'événement",
    },
    withdrawal_requested: {
      subject: "Demande de rétractation enregistrée pour {{evenement}}",
      preheader: "Le remboursement attend une confirmation du prestataire.",
      paragraphs: [
        "La demande de rétractation pour {{offre}}, événement {{evenement}}, est enregistrée.",
        "Référence : {{reference}}. Montant : {{montant}} {{devise}}.",
        "Le remboursement n'est pas encore confirmé. Un message partira lorsque Mollie aura confirmé le résultat.",
      ],
      button: "Voir l'événement",
    },
    retention_warning: {
      subject: "{{evenement}} sera supprimé dans trente jours",
      preheader: "La fin d'accès approche.",
      paragraphs: [
        "L'accès à {{evenement}} se termine le {{date}}.",
        "Passé ce délai, les données de l'événement et leurs copies sont supprimées, sauf les pièces de paiement conservées à part.",
      ],
      button: "Ouvrir l'événement",
    },
    draft_warning: {
      subject: "Brouillon {{evenement}} inactif",
      preheader: "Suppression prévue sans reprise.",
      paragraphs: [
        "Le brouillon {{evenement}} n'a pas été modifié depuis plusieurs mois.",
        "Sans reprise, il sera supprimé le mois suivant cet avertissement.",
      ],
      button: "Reprendre le brouillon",
    },
    account_inactive: {
      subject: "Compte Sous pli inactif",
      preheader: "Suppression prévue dans trente jours sans connexion.",
      paragraphs: [
        "Aucune connexion n'a été constatée depuis vingt-quatre mois.",
        "Sans nouvelle connexion dans les trente jours, le compte et les données associées qui peuvent l'être seront supprimés. Un échange encore en cours dont vous êtes l'organisateur bloque cette suppression.",
      ],
      button: "Ouvrir Sous pli",
    },
    password_reset: {
      subject: "Nouveau mot de passe Sous pli",
      preheader: "Lien personnel, sans autre information de compte.",
      paragraphs: [
        "Une réinitialisation du mot de passe a été demandée pour ce compte.",
        "Le lien est personnel. Il expire selon la durée de Firebase Authentication et ne fonctionne plus une fois utilisé.",
        "Si tu n'es pas à l'origine de cette demande, ignore ce message.",
      ],
      button: "Choisir un nouveau mot de passe",
    },
    email_verification: {
      subject: "Confirme ton adresse Sous pli",
      preheader: "Vérification de l'adresse, sans autre contenu.",
      paragraphs: [
        "Confirme cette adresse pour utiliser les actions d'organisateur qui l'exigent.",
        "En attendant, l'aide reste consultable et ce message peut être renvoyé depuis le profil.",
      ],
      button: "Confirmer l'adresse",
    },
    email_change: {
      subject: "Confirme la nouvelle adresse Sous pli",
      preheader: "L'adresse actuelle reste en service jusqu'à confirmation.",
      paragraphs: [
        "Confirme la nouvelle adresse demandée pour ce compte.",
        "L'adresse actuelle n'est remplacée qu'après ouverture de ce lien officiel.",
      ],
      button: "Confirmer la nouvelle adresse",
    },
    email_change_notice: {
      subject: "Demande de changement d'adresse Sous pli",
      preheader: "Information de sécurité, sans lien de modification.",
      paragraphs: [
        "Une demande de changement d'adresse a été enregistrée pour ce compte.",
        "Si tu n'es pas à l'origine de cette demande, connecte-toi et vérifie le profil. Ce message ne contient pas de lien de modification.",
      ],
      button: "Ouvrir le profil",
    },
    account_deleted: {
      subject: "Suppression du compte Sous pli terminée",
      preheader: "Confirmation après traitement, sans contenu du compte.",
      paragraphs: [
        "La suppression du compte est terminée.",
        "Les participations, fichiers et messages qui pouvaient l'être ont été retirés ou anonymisés. Les archives de paiement exigées restent à part. Ce message ne reprend pas le contenu du compte.",
      ],
      button: "Retour à l'accueil",
    },
  };
}

const CACHE = new Map<string, Bundle>();

export function templateCopy(context: ContextKind, tone: Tone): Bundle {
  const key = `${context}:${tone}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const built = bundle(tone, context);
  CACHE.set(key, built);
  return built;
}
