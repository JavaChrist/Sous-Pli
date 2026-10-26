import { appConfig } from "../config";
import { publisher } from "../publisher";
import {
  PALETTES,
  TEMPLATE_VERSION,
  templateCopy,
  type EmailTheme,
  type TemplateId,
} from "./templates";

export const ALLOWED_VARIABLES = [
  "prenom",
  "evenement",
  "organisateur",
  "structure",
  "date",
  "heure",
  "budget",
  "devise",
  "lieu",
  "regles",
  "lien",
  "signature",
  "equipe",
  "offre",
  "montant",
  "reference",
  "mention_fiscale",
] as const;

export type VariableName = (typeof ALLOWED_VARIABLES)[number];
export type TemplateVars = Partial<Record<VariableName, string>>;

const REQUIRED: VariableName[] = ["prenom", "evenement", "organisateur", "date", "heure", "lien", "signature"];
const FALLBACKS: Partial<Record<VariableName, string>> = {
  lieu: "non précisé",
  budget: "non précisé",
  devise: "EUR",
  regles: "Aucune consigne supplémentaire.",
  structure: "le groupe",
  equipe: "non précisée",
  mention_fiscale: "",
  offre: "Famille & amis",
  montant: "0,00 €",
  reference: "aucune",
};

export const PREVIEW_VARS: Record<VariableName, string> = {
  prenom: "Camille",
  evenement: "Échange exemple",
  organisateur: "Alex Martin",
  structure: "Atelier des tilleuls",
  date: "jeudi 24 décembre 2026",
  heure: "18:30",
  budget: "20 à 30",
  devise: "EUR",
  lieu: "salle commune",
  regles: "Un cadeau fait main est le bienvenu.",
  lien: "https://exemple.invalid/apercu-test",
  signature: "Alex",
  equipe: "Équipe accueil",
  offre: "Entreprise",
  montant: "19,90 €",
  reference: "commande-exemple",
  mention_fiscale: "TVA non applicable, article 293 B du Code général des impôts",
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  templateVersion: number;
}

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeHeader(value: string, max = 140): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function renderEmail(
  theme: EmailTheme,
  templateId: TemplateId,
  vars: TemplateVars,
  options?: { allowLocalHttp?: boolean },
): RenderedEmail {
  const copy = templateCopy(theme.context, theme.tone)[templateId];
  const values = resolveVars(vars, options?.allowLocalHttp === true);
  const subjectSource = theme.subjectOverrides[templateId]?.trim() || copy.subject;
  assertKnownPlaceholders(subjectSource);
  const subject = sanitizeHeader(fill(subjectSource, values));
  if (subject.includes("{{")) throw new TemplateError("Une variable est restée brute dans l'objet.");

  const paragraphs = [...copy.paragraphs];
  if (theme.intro.trim()) paragraphs.splice(1, 0, theme.intro.trim());
  if (theme.instructions.trim()) paragraphs.push(theme.instructions.trim());
  paragraphs.push(theme.signature.trim() || values.signature);

  const textParts = paragraphs.map((part) => fill(part, values));
  for (const part of textParts) {
    if (part.includes("{{")) throw new TemplateError("Une variable est restée brute dans le message.");
  }
  const button = sanitizeHeader(theme.buttonLabel.trim() || copy.button, 40);
  const preheader = fill(copy.preheader, values);
  const html = layout({
    theme,
    preheader,
    paragraphs: textParts,
    button,
    link: values.lien,
  });
  if (html.includes("{{")) throw new TemplateError("Une variable est restée brute dans le HTML.");
  return {
    subject,
    html,
    text: [subject, "", ...textParts, "", `${button} : ${values.lien}`, "", footerText()].join("\n"),
    templateVersion: TEMPLATE_VERSION,
  };
}

function resolveVars(vars: TemplateVars, allowLocalHttp = false): Record<VariableName, string> {
  const resolved = {} as Record<VariableName, string>;
  for (const name of ALLOWED_VARIABLES) {
    const raw = vars[name]?.trim() ?? "";
    if (!raw) {
      if (REQUIRED.includes(name)) throw new TemplateError(`La variable ${name} est manquante.`);
      resolved[name] = FALLBACKS[name] ?? "";
    } else {
      resolved[name] = raw;
    }
  }
  const local = allowLocalHttp && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/\S*$/i.test(resolved.lien);
  if (!/^https:\/\/\S+$/i.test(resolved.lien) && !local) throw new TemplateError("Le lien doit commencer par https.");
  return resolved;
}

function assertKnownPlaceholders(source: string) {
  const found = source.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  for (const match of found) {
    if (!ALLOWED_VARIABLES.includes(match[1] as VariableName)) {
      throw new TemplateError(`La variable ${match[1]} n'est pas autorisée.`);
    }
  }
}

function fill(source: string, values: Record<VariableName, string>): string {
  assertKnownPlaceholders(source);
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: VariableName) => values[name] ?? "");
}

function layout(input: {
  theme: EmailTheme;
  preheader: string;
  paragraphs: string[];
  button: string;
  link: string;
}): string {
  const colors = PALETTES[input.theme.palette];
  const brand = safeLogo(input.theme.logoUrl);
  const title = escapeHtml(input.theme.organizationName || appConfig.name);
  const logoBlock = `<img src="${escapeHtml(appLogoUrl())}" alt="${escapeHtml(appConfig.name)}" width="72" height="72" style="display:block;width:72px;height:72px;border:0;border-radius:16px;margin:0 0 16px;" />
${brand ? `<img src="${escapeHtml(brand)}" alt="${title}" width="72" height="72" style="display:block;width:72px;height:72px;border:0;border-radius:16px;margin:0 0 16px;" />` : ""}
<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:${colors.primary};">${title}</p>`;
  const body = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:${colors.text};">${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`,
    )
    .join("");
  const href = escapeHtml(input.link);
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:${colors.background};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.background};"><tr><td align="center" style="padding:32px 20px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fffdf8;border:1px solid #d9cbb6;border-radius:18px;border-collapse:separate;">
<tr><td style="padding:40px 36px;">${logoBlock}
<p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${colors.accent};">${escapeHtml(contextLine(input.theme))}</p>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="background:${colors.primary};border-radius:999px;">
<a href="${href}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;line-height:1.2;">${escapeHtml(input.button)}</a>
</td></tr></table>
<p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#5c564e;">Si le bouton ne s'affiche pas : <a href="${href}" style="color:${colors.primary};">${href}</a></p>
<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#5c564e;">${escapeHtml(footerText())}</p>
</td></tr></table></td></tr></table></body></html>`;
}

function appLogoUrl(): string {
  return `${publisher.publicUrl}/logo512.png`;
}

function safeLogo(url: string): string {
  if (!url.trim()) return "";
  if (!/^https:\/\/[^\s]+$/i.test(url.trim())) return "";
  return url.trim();
}

function contextLine(theme: EmailTheme): string {
  if (theme.identity === "service") return "Sous pli";
  if (theme.context === "family") return "Échange en famille";
  if (theme.context === "friends") return "Échange entre amis";
  return "Échange professionnel";
}

function footerText(): string {
  return "Cet e-mail concerne uniquement l'organisation de l'échange. Il n'est pas une lettre d'information commerciale. Le résultat du tirage se consulte dans l'espace protégé, jamais dans l'objet ni dans ce message.";
}
