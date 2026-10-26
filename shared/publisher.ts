/** Faits d'éditeur confirmés le 22 octobre 2026. Aucun numéro de TVA intracommunautaire. */
export const publisher = {
  appName: "Sous pli",
  publicUrl: "https://souspli.fr",
  editorName: "Christian Grohens",
  legalForm: "entrepreneur individuel",
  tradeName: "JavaChrist",
  registration: "RCS Toulouse 338 593 312",
  siren: "338 593 312",
  siret: "338 593 312 00030",
  address: "5 rue Maurice Fonvieille, 31120 Portet-sur-Garonne, France",
  publicationDirector: "Christian Grohens",
  email: "support@souspli.fr",
  phone: "09 52 62 31 71",
  taxMention: "TVA non applicable, article 293 B du Code général des impôts",
  termsVersion: "2026-10-22",
  processingAnnexVersion: "2026-10-22",
} as const;

export const hosting = {
  application: {
    name: "Vercel Inc.",
    address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
    site: "https://vercel.com",
    source: "https://vercel.com/legal/privacy-notice (1er juin 2026) et https://vercel.com/legal/dpa (17 mars 2026)",
  },
  domain: {
    name: "IONOS SARL",
    address: "7, place de la Gare — BP 70109, 57200 Sarreguemines Cedex, France",
    phone: "09 70 80 89 11",
    site: "https://www.ionos.fr",
    source: "https://www.ionos.fr/terms-gtc/terms-imprint/",
  },
} as const;

export const processors = {
  firebase:
    "Google (Firebase) : authentification, base de données, fichiers et fonctions serveur.",
  resend: {
    name: "Plus Five Five, Inc. (Resend)",
    address: "2261 Market Street #5039, San Francisco, CA 94114, États-Unis",
    site: "https://resend.com",
    source: "https://www.dataprivacyframework.gov/participant/8907",
  },
  mollie: {
    name: "Mollie B.V.",
    address: "Keizersgracht 126, 1015 CW Amsterdam, Pays-Bas",
    register: "30204462",
    site: "https://www.mollie.com",
    source: "https://www.mollie.com/legal/impressum et registre public DNB, relation F0038",
  },
} as const;

export const mediator = {
  name: "MÉDIATION CONSOMMATION DÉVELOPPEMENT",
  address: "Centre d'Affaires Stéphanois, Immeuble l'Horizon — Esplanade de France, 3 rue J. Constant Milleret, 42000 Saint-Étienne",
  site: "https://www.medconsodev.eu/",
} as const;
