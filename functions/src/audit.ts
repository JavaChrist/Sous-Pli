import { db, stamp } from "./admin";

export async function audit(eventId: string, actorUid: string, action: string) {
  await db.collection("events").doc(eventId).collection("audit").add({
    action,
    actorUid,
    at: stamp(),
  });
}
