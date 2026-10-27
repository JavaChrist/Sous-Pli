/** Nom, couleurs et limites. Seule source du nom affiché. */
export const appConfig = {
  name: "Sous pli",
  shortName: "Sous pli",
  description:
    "Organisez un échange de cadeaux secret en famille, entre amis ou au travail. Chacun découvre son destinataire dans un espace protégé.",
  themeColor: "#1B4332",
  backgroundColor: "#F4EFE6",
  defaultCurrency: "EUR",
  defaultTimeZone: "Europe/Paris",
  invitationDays: 30,
  region: "europe-west1",
  supportEmailPlaceholder: "support@souspli.fr",
} as const;

/**
 * Plafond technique anti-abus, distinct des capacités commerciales.
 * L'offre fixe la capacité réellement appliquée, au plus 300 en libre-service.
 */
export const limits = {
  maxMembers: 300,
  maxEventsPerOrganizer: 50,
  maxGiftsPerPerson: 5,
  minMembersForDraw: 2,
  maxWishItems: 30,
  maxWishText: 280,
  maxMessageLength: 1000,
  messagesPerWindow: 20,
  messageWindowMs: 10 * 60 * 1000,
  maxImageBytes: 2 * 1024 * 1024,
  maxPendingJoins: 100,
  suggestedFamilySize: 20,
  drawNodeLimit: 250_000,
  resendMaxAttempts: 5,
} as const;

export const billingConfig = {
  enabled: false,
  provider: "mollie" as const,
  realChargesEnabled: true,
  taxRegime: "franchise_base" as const,
  statement:
    "Un paiement par événement. Aucun abonnement. Les participants ne paient jamais. Le paiement est encaissé par Mollie.",
} as const;
