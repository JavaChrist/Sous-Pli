import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, test } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "sous-pli-local",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("events/event0001").set({ organizerUid: "orga0001" });
    await context.firestore().doc("events/event0001/memberIndex/member01").set({ memberId: "mem00001" });
    await context.storage().ref("events/event0001/brand/logo.png").put(Buffer.from("png"), { contentType: "image/png" });
    await context.storage().ref("events/event0001/wishes/mem00001/photo.jpg").put(Buffer.from("jpg"), { contentType: "image/jpeg" });
  });
});

afterAll(async () => {
  await env.cleanup();
});

test("une image de marque est lisible, un chemin inconnu ne l'est pas", async () => {
  const storage = env.unauthenticatedContext().storage();
  await assertSucceeds(storage.ref("events/event0001/brand/logo.png").getMetadata());
  await assertFails(storage.ref("prive/secret.txt").getMetadata());
});

test("un tiers ne lit pas la photo de souhait", async () => {
  const storage = env.authenticatedContext("autre0001").storage();
  await assertFails(storage.ref("events/event0001/wishes/mem00001/photo.jpg").getMetadata());
});

test("personne ne dépose une nouvelle photo de souhait", async () => {
  const storage = env.authenticatedContext("member01").storage();
  await assertFails(storage.ref("events/event0001/wishes/mem00001/nouvelle.jpg").put(Buffer.from("jpg"), { contentType: "image/jpeg" }).then());
});

test("le participant lit sa photo et l'organisateur aussi", async () => {
  await assertSucceeds(env.authenticatedContext("member01").storage().ref("events/event0001/wishes/mem00001/photo.jpg").getMetadata());
  await assertSucceeds(env.authenticatedContext("orga0001").storage().ref("events/event0001/wishes/mem00001/photo.jpg").getMetadata());
});
