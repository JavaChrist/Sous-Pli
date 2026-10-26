/**
 * Jeu de données local uniquement. Refus d'écrire si les émulateurs ne sont pas la cible.
 * Mot de passe de démonstration, jamais à réutiliser hors de la machine.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = "sous-pli-local";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

if (!process.env.FIRESTORE_EMULATOR_HOST.includes("127.0.0.1") && !process.env.FIRESTORE_EMULATOR_HOST.includes("localhost")) {
  throw new Error("Le seed refuse toute cible autre que l'émulateur local.");
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

const email = "organisateur@exemple.local";
const password = "motdepasse-local";

async function main() {
const existing = await auth.getUserByEmail(email).catch(() => null);
const user = existing ?? await auth.createUser({ email, password, displayName: "Camille", emailVerified: true });
const eventId = "demo-famille";
const now = Timestamp.now();
const starts = Timestamp.fromDate(new Date("2026-12-24T18:00:00.000Z"));

await db.collection("events").doc(eventId).set({
  name: "Noël de démonstration",
  occasion: "christmas",
  context: "family",
  place: "Chez Camille",
  description: "Échange local, sans envoi réel.",
  rulesText: "Un cadeau, budget libre.",
  localDate: "2026-12-24",
  localTime: "19:00",
  timeZone: "Europe/Paris",
  startsAt: starts,
  revealLocalDate: "2026-12-24",
  revealLocalTime: "19:00",
  revealAt: starts,
  budget: { min: 20, max: 20, currency: "EUR", handmade: false, secondHand: false },
  privacyMode: "classic",
  giftsPerPerson: 1,
  avoidReciprocal: true,
  organizerParticipates: true,
  joinPolicy: "approval",
  organizationName: "",
  teamName: "",
  organizerUid: user.uid,
  status: "draft",
  drawVersion: 0,
  idempotencyKey: null,
  launchReceipt: null,
  stats: { members: 4, joined: 1, invited: 0, discovered: 0, wishes: 0, messages: 0 },
  createdAt: now,
  updatedAt: now,
});

const people = [
  { id: "m-camille", name: "Camille", role: "organizer", uid: user.uid },
  { id: "m-lea", name: "Léa", role: "participant" },
  { id: "m-noah", name: "Noah", role: "participant" },
  { id: "m-ines", name: "Inès", role: "participant" },
];

for (const person of people) {
  await db.collection("events").doc(eventId).collection("members").doc(person.id).set({
    displayName: person.name,
    status: person.uid ? "joined" : "draft",
    role: person.role,
    managedByMemberId: null,
    groupLabel: "",
    updatedAt: now,
  });
  await db.collection("events").doc(eventId).collection("memberPrivate").doc(person.id).set({
    email: person.uid ? email : "",
  });
  if (person.uid) {
    await db.collection("events").doc(eventId).collection("memberIndex").doc(person.uid).set({
      uid: person.uid,
      memberId: person.id,
      eventId,
      eventName: "Noël de démonstration",
      status: "draft",
      updatedAt: now,
    });
  }
}

console.log(`Compte local : ${email} / ${password}`);
console.log(`Échange : ${eventId}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
