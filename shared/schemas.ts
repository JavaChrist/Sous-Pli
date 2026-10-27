import { z } from "zod";
import { OFFER_IDS } from "./billing";
import { limits } from "./config";
import { TEMPLATE_IDS } from "./email/templates";

const timeZone = z.string().trim().min(1).max(80);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const localTime = z.string().regex(/^\d{2}:\d{2}$/);
const id = z.string().trim().min(8).max(80);

export const budgetSchema = z
  .object({
    min: z.number().min(0).max(100000),
    max: z.number().min(0).max(100000),
    currency: z.string().regex(/^[A-Z]{3}$/),
    handmade: z.boolean(),
    secondHand: z.boolean(),
  })
  .refine((budget) => budget.min <= budget.max, { message: "Le minimum dépasse le maximum." });

export const eventInputSchema = z.object({
  eventId: id.optional(),
  name: z.string().trim().min(2).max(80),
  occasion: z.enum(["christmas", "annual", "other"]),
  context: z.enum(["family", "friends", "organization"]),
  localDate,
  localTime,
  timeZone,
  place: z.string().trim().max(160).default(""),
  description: z.string().trim().max(2000).default(""),
  rulesText: z.string().trim().max(2000).default(""),
  budget: budgetSchema.nullable(),
  privacyMode: z.enum(["classic", "public", "double_blind"]),
  giftsPerPerson: z.number().int().min(1).max(limits.maxGiftsPerPerson),
  avoidReciprocal: z.boolean(),
  organizerParticipates: z.boolean(),
  revealLocalDate: localDate,
  revealLocalTime: localTime,
  joinPolicy: z.enum(["approval", "open", "closed"]),
  organizationName: z.string().trim().max(80).default(""),
  teamName: z.string().trim().max(80).default(""),
  offerId: z.enum(OFFER_IDS).optional(),
});

export const memberInputSchema = z.object({
  memberId: id.optional(),
  displayName: z.string().trim().min(1).max(80),
  email: z
    .string()
    .trim()
    .max(160)
    .default("")
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Adresse e-mail invalide."),
  groupLabel: z.string().trim().max(40).default(""),
  managedByMemberId: id.nullable().optional(),
});

export const membersInputSchema = z.object({
  eventId: id,
  members: z.array(memberInputSchema).max(limits.maxMembers),
});

export const constraintSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("directional"), fromId: id, toId: id }),
  z.object({ kind: z.literal("reciprocal"), aId: id, bId: id }),
  z.object({ kind: z.literal("group"), memberIds: z.array(id).min(2).max(limits.maxMembers) }),
  z.object({ kind: z.literal("history"), fromId: id, toId: id }),
]);

export const constraintsInputSchema = z.object({
  eventId: id,
  constraints: z.array(constraintSchema).max(400),
  avoidPriorPairs: z.boolean().optional(),
});

export const wishItemSchema = z.object({
  id: z.string().trim().min(4).max(40),
  text: z.string().trim().min(1).max(limits.maxWishText),
  url: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((value) => value === "" || /^https:\/\/.{3,}$/.test(value), "Le lien doit être en HTTPS."),
  price: z.string().trim().max(40).default(""),
  note: z.string().trim().max(280).default(""),
});

export const wishlistSchema = z.object({
  eventId: id,
  items: z.array(wishItemSchema).max(limits.maxWishItems),
  sizes: z.string().trim().max(200).default(""),
  avoid: z.string().trim().max(500).default(""),
});

export const emailThemeSchema = z.object({
  eventId: id,
  palette: z.enum(["sapin", "bordeaux", "soiree", "sobre"]),
  tone: z.enum(["tu", "vous"]),
  fromName: z.string().trim().max(80).default(""),
  organizationName: z.string().trim().max(80).default(""),
  teamName: z.string().trim().max(80).default(""),
  logoUrl: z
    .string()
    .trim()
    .max(400)
    .default("")
    .refine((value) => value === "" || /^https:\/\/[^\s]+$/.test(value), "Le logo doit être une adresse HTTPS."),
  intro: z.string().trim().max(800).default(""),
  instructions: z.string().trim().max(800).default(""),
  buttonLabel: z.string().trim().max(40).default(""),
  signature: z.string().trim().max(160).default(""),
  replyToEnabled: z.boolean(),
  subjectOverrides: z
    .partialRecord(z.enum(TEMPLATE_IDS), z.string().trim().max(140))
    .default({}),
});

export const messageSchema = z.object({
  eventId: id,
  threadId: id,
  body: z.string().trim().min(1).max(limits.maxMessageLength),
});

export type EventInput = z.infer<typeof eventInputSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;
