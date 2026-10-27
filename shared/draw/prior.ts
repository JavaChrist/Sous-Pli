import type { Exclusion } from "../domain";

export interface RosterPerson {
  memberId: string;
  email: string;
  name: string;
}

export interface PastPair {
  fromToken: string;
  toToken: string;
}

/** Identifie une personne par son e-mail, sinon par son nom s'il est unique. */
export function personToken(email: string, name: string): string {
  const mail = email.trim().toLowerCase();
  if (mail) return `email:${mail}`;
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized ? `name:${normalized}` : "";
}

export function historyFromPast(current: RosterPerson[], past: PastPair[]): Exclusion[] {
  const byToken = new Map<string, string[]>();
  for (const person of current) {
    const token = personToken(person.email, person.name);
    if (!token) continue;
    const ids = byToken.get(token) ?? [];
    ids.push(person.memberId);
    byToken.set(token, ids);
  }
  const seen = new Set<string>();
  const exclusions: Exclusion[] = [];
  for (const pair of past) {
    const fromIds = byToken.get(pair.fromToken) ?? [];
    const toIds = byToken.get(pair.toToken) ?? [];
    if (fromIds.length !== 1 || toIds.length !== 1) continue;
    const fromId = fromIds[0];
    const toId = toIds[0];
    if (!fromId || !toId || fromId === toId) continue;
    const key = `${fromId}->${toId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    exclusions.push({ kind: "history", fromId, toId });
  }
  return exclusions;
}

export function mergeExclusions(base: Exclusion[], prior: Exclusion[]): Exclusion[] {
  const seen = new Set(base.map(exclusionKey));
  return [...base, ...prior.filter((item) => !seen.has(exclusionKey(item)))];
}

function exclusionKey(exclusion: Exclusion): string {
  if (exclusion.kind === "group") return `group:${[...exclusion.memberIds].sort().join(",")}`;
  if (exclusion.kind === "reciprocal") return `pair:${[exclusion.aId, exclusion.bId].sort().join(":")}`;
  return `${exclusion.kind}:${exclusion.fromId}->${exclusion.toId}`;
}
