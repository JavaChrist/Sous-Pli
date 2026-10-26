export interface InvitationRecord {
  revoked: boolean;
  expiresAt: number;
  claimedByUid: string | null;
}

export type InvitationState = "valid" | "expired" | "revoked" | "claimed" | "already-yours" | "invalid";

/** Lecture seule : ne modifie pas le jeton. Un aperçu ou un scanner ne consomme donc rien. */
export function inspectInvitationState(
  record: InvitationRecord | null,
  now: number,
  uid?: string | null,
): InvitationState {
  if (!record) return "invalid";
  if (record.revoked) return "revoked";
  if (record.expiresAt <= now) return "expired";
  if (record.claimedByUid) {
    if (uid && record.claimedByUid === uid) return "already-yours";
    return "claimed";
  }
  return "valid";
}

export function canClaim(state: InvitationState): boolean {
  return state === "valid" || state === "already-yours";
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomJoinCode(length = 8): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return [...buffer].map((byte) => JOIN_ALPHABET[byte % JOIN_ALPHABET.length]).join("");
}
