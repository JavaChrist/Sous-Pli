import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, test } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "sous-pli-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("events/event0001").set({ organizerUid: "orga0001", name: "Noël", status: "draft", privacyMode: "classic" });
    await db.doc("events/event0001/memberIndex/member01").set({ uid: "member01", memberId: "mem00001" });
    await db.doc("events/event0001/memberPrivate/mem00001").set({ email: "a@exemple.fr" });
    await db.doc("events/event0001/serverData/draw").set({ hidden: true });
    await db.doc("users/member01/assignments/event0001").set({ slots: [] });
    await db.doc("users/member01/notifications/note0001").set({ title: "Bonjour", body: "Un message", read: false });
  });
});

afterAll(async () => {
  await env.cleanup();
});

test("un visiteur anonyme ne lit pas un échange", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(db.doc("events/event0001").get());
});

test("l'organisateur lit son échange et les adresses", async () => {
  const db = env.authenticatedContext("orga0001").firestore();
  await assertSucceeds(db.doc("events/event0001").get());
  await assertSucceeds(db.doc("events/event0001/memberPrivate/mem00001").get());
});

test("un participant lit l'échange mais pas les adresses ni le tirage", async () => {
  const db = env.authenticatedContext("member01").firestore();
  await assertSucceeds(db.doc("events/event0001").get());
  await assertFails(db.doc("events/event0001/memberPrivate/mem00001").get());
  await assertFails(db.doc("events/event0001/serverData/draw").get());
});

test("un tiers ne lit pas l'échange", async () => {
  const db = env.authenticatedContext("autre0001").firestore();
  await assertFails(db.doc("events/event0001").get());
});

test("personne n'écrit un échange ni un paiement depuis le client", async () => {
  const db = env.authenticatedContext("orga0001").firestore();
  await assertFails(db.doc("events/event0001").update({ name: "Piraté", commercialStatus: "paid", offerId: "business_plus" }));
  await assertFails(db.doc("payments/pay00001").set({ status: "succeeded", amountCents: 1 }));
});

test("chacun ne lit que sa propre attribution", async () => {
  await assertSucceeds(env.authenticatedContext("member01").firestore().doc("users/member01/assignments/event0001").get());
  await assertFails(env.authenticatedContext("orga0001").firestore().doc("users/member01/assignments/event0001").get());
});

test("chacun lit ses participations, pas celles d'un autre", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("events/event0001/memberIndex/member01").set({
      uid: "member01",
      memberId: "mem00001",
      updatedAt: new Date(),
    });
  });
  const mine = env.authenticatedContext("member01").firestore().collectionGroup("memberIndex").where("uid", "==", "member01").orderBy("updatedAt", "desc");
  await assertSucceeds(mine.get());
  const foreign = env.authenticatedContext("autre0001").firestore().collectionGroup("memberIndex").where("uid", "==", "member01");
  await assertFails(foreign.get());
  await assertSucceeds(env.authenticatedContext("orga0001").firestore().collection("events/event0001/memberIndex").get());
  await assertFails(env.authenticatedContext("autre0001").firestore().doc("events/event0001/memberIndex/member01").get());
});

test("une notification ne peut changer que le marqueur lu", async () => {
  const ref = env.authenticatedContext("member01").firestore().doc("users/member01/notifications/note0001");
  await assertSucceeds(ref.update({ read: true }));
  await assertFails(ref.update({ title: "Autre" }));
});
