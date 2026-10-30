import { HttpsError } from "firebase-functions/v2/https";
import type { PrivacyMode } from "../../shared/domain";
import { ideasForViewer, type GiftIdeaRecord } from "../../shared/ideas";
import { giftIdeaDeleteSchema, giftIdeaSchema } from "../../shared/schemas";
import { callable, db, newId, stamp } from "./admin";
import { readMembers } from "./events";
import { copyWishes, type StoredAssignment } from "./views";

const MAX_IDEAS = 40;

async function memberContext(eventId: string, uid: string) {
  const index = await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).get();
  if (!index.exists) throw new HttpsError("permission-denied", "Vous ne participez pas à cet échange.");
  return { memberId: String(index.data()?.memberId ?? "") };
}

async function refreshCopiedWishes(eventId: string) {
  const event = await db.collection("events").doc(eventId).get();
  const status = String(event.data()?.status ?? "");
  if (!["drawn", "revealed", "archived"].includes(status)) return;
  const draw = await db.collection("events").doc(eventId).collection("serverData").doc("draw").get();
  const assignments = (draw.data()?.assignments ?? []) as StoredAssignment[];
  const members = await readMembers(eventId);
  await copyWishes(eventId, (event.data()?.privacyMode ?? "classic") as PrivacyMode, status !== "drawn", members, assignments);
}

function asIdeas(docs: Array<{ id: string; data: () => Record<string, unknown> }>): GiftIdeaRecord[] {
  return docs.map((item) => ({
    id: item.id,
    aboutMemberId: String(item.data().aboutMemberId ?? ""),
    authorMemberId: String(item.data().authorMemberId ?? ""),
    authorName: String(item.data().authorName ?? "Participant"),
    text: String(item.data().text ?? ""),
  }));
}

export const listGiftIdeas = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  if (eventId.length < 8) throw new HttpsError("invalid-argument", "Échange introuvable.");
  const { memberId } = await memberContext(eventId, uid);
  const event = await db.collection("events").doc(eventId).get();
  if (!event.exists) throw new HttpsError("not-found", "Échange introuvable.");
  const members = await readMembers(eventId);
  const names = new Map(members.map((member) => [member.id, member.displayName]));
  const ideasSnap = await db.collection("events").doc(eventId).collection("giftIdeas").get();
  const status = String(event.data()?.status ?? "");
  const privacy = String(event.data()?.privacyMode ?? "classic");
  const showNames = privacy !== "double_blind" || status === "revealed" || status === "archived";
  let recipientIds: string[] = [];
  const slots = new Map<string, number>();
  if (["drawn", "revealed", "archived"].includes(status)) {
    const draw = await db.collection("events").doc(eventId).collection("serverData").doc("draw").get();
    const assignments = (draw.data()?.assignments ?? []) as StoredAssignment[];
    for (const edge of assignments) {
      if (edge.giverId !== memberId) continue;
      recipientIds.push(edge.recipientId);
      slots.set(edge.recipientId, edge.slot);
    }
  }
  const visible = ideasForViewer({ viewerMemberId: memberId, recipientIds, ideas: asIdeas(ideasSnap.docs) });
  const wishSnap = await db.collection("events").doc(eventId).collection("wishlists").get();
  const wishes = new Map(wishSnap.docs.map((item) => [item.id, item.data()]));
  return {
    people: members
      .filter((member) => member.id !== memberId)
      .map((member) => ({ id: member.id, displayName: member.displayName })),
    mine: visible.mine.map((idea) => ({ id: idea.id, aboutMemberId: idea.aboutMemberId, text: idea.text })),
    recipients: recipientIds.map((id) => {
      const wish = wishes.get(id) ?? {};
      const items = Array.isArray(wish.items) ? wish.items : [];
      return {
        memberId: showNames ? id : null,
        label: showNames ? names.get(id) ?? "Participant" : `Destinataire ${slots.get(id) ?? ""}`.trim(),
        wishes: items.map((item) => {
          const entry = item as { text?: string; url?: string; image?: string };
          return {
            text: String(entry.text ?? ""),
            url: String(entry.url ?? ""),
            image: showNames ? String(entry.image ?? "") : "",
          };
        }).filter((item) => item.text || item.url || item.image),
        ideas: visible.forRecipients
          .filter((idea) => idea.aboutMemberId === id)
          .map((idea) => ({ authorName: idea.authorName, text: idea.text })),
      };
    }),
  };
});

export const addGiftIdea = callable(async (request, uid) => {
  const parsed = giftIdeaSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Idée invalide.");
  const { memberId } = await memberContext(parsed.data.eventId, uid);
  if (parsed.data.aboutMemberId === memberId) {
    throw new HttpsError("invalid-argument", "Pour vous-même, écrivez l'idée dans vos souhaits.");
  }
  const members = await readMembers(parsed.data.eventId);
  const author = members.find((member) => member.id === memberId);
  const about = members.find((member) => member.id === parsed.data.aboutMemberId);
  if (!author || !about) throw new HttpsError("invalid-argument", "Cette personne ne fait pas partie de l'échange.");
  const existing = await db.collection("events").doc(parsed.data.eventId).collection("giftIdeas").where("authorMemberId", "==", memberId).get();
  if (existing.size >= MAX_IDEAS) {
    throw new HttpsError("resource-exhausted", "Le nombre maximum d'idées pour ce compte est atteint.");
  }
  const id = newId();
  await db.collection("events").doc(parsed.data.eventId).collection("giftIdeas").doc(id).set({
    aboutMemberId: about.id,
    authorMemberId: author.id,
    authorName: author.displayName,
    text: parsed.data.text,
    createdAt: stamp(),
    updatedAt: stamp(),
  });
  await refreshCopiedWishes(parsed.data.eventId);
  return { id };
});

export const deleteGiftIdea = callable(async (request, uid) => {
  const parsed = giftIdeaDeleteSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Idée introuvable.");
  const { memberId } = await memberContext(parsed.data.eventId, uid);
  const ref = db.collection("events").doc(parsed.data.eventId).collection("giftIdeas").doc(parsed.data.ideaId);
  const idea = await ref.get();
  if (!idea.exists) throw new HttpsError("not-found", "Idée introuvable.");
  if (String(idea.data()?.authorMemberId ?? "") !== memberId) {
    throw new HttpsError("permission-denied", "Seul l'auteur retire cette idée.");
  }
  await ref.delete();
  await refreshCopiedWishes(parsed.data.eventId);
  return { ok: true };
});
