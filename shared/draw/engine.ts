import { limits } from "../config";
import type { Assignment, Exclusion } from "../domain";

export interface DrawReason {
  memberId: string;
  code:
    | "not-enough-recipients"
    | "not-enough-givers"
    | "unknown-member"
    | "duplicate-member"
    | "invalid-k"
    | "too-few-members"
    | "too-many-members"
    | "locked-conflict"
    | "locked-member-missing";
  available: number;
  required: number;
}

export type DrawResult =
  | {
      ok: true;
      assignments: Assignment[];
      reciprocalPreferenceRelaxed: boolean;
      distribution: "randomized-backtracking" | "randomized-flow";
    }
  | {
      ok: false;
      code: "invalid-input" | "impossible" | "resource-limit";
      reasons: DrawReason[];
    };

export interface SolveInput {
  memberIds: string[];
  giftsPerPerson: number;
  exclusions: Exclusion[];
  avoidReciprocal: boolean;
  locked?: Assignment[];
  rng?: () => number;
  nodeLimit?: number;
  allowFlowFallback?: boolean;
}

/**
 * Propriétés réelles :
 * - source aléatoire : crypto.getRandomValues, mélangée par Fisher-Yates ;
 * - le premier essai est un retour arrière avec heuristique du plus contraint,
 *   donc un blocage du dernier participant provoque un retour, pas un tirage partiel ;
 * - si cette recherche dépasse le budget de nœuds, un flot maximal à arêtes mélangées
 *   cherche une solution faisable, sauf quand des paires sont verrouillées ou que
 *   l'évitement des réciprocités est encore exigé ;
 * - la distribution n'est pas démontrée uniforme sur l'ensemble des solutions ;
 * - une exclusion stricte n'est jamais retirée en silence ;
 * - l'évitement des paires réciproques est une préférence : si aucune solution ne
 *   la respecte, une solution qui l'abandonne peut être renvoyée avec le drapeau dédié.
 */
export function solveDraw(input: SolveInput): DrawResult {
  const rng = input.rng ?? cryptoRandom;
  const nodeLimit = input.nodeLimit ?? limits.drawNodeLimit;
  const allowFlow = input.allowFlowFallback !== false;
  const memberIds = input.memberIds;
  const k = input.giftsPerPerson;
  const reasons: DrawReason[] = [];

  if (!Number.isInteger(k) || k < 1 || k > limits.maxGiftsPerPerson) {
    return fail("invalid-input", [{ memberId: "", code: "invalid-k", available: 0, required: k }]);
  }
  if (memberIds.length < Math.max(limits.minMembersForDraw, k + 1)) {
    return fail("invalid-input", [
      { memberId: "", code: "too-few-members", available: memberIds.length, required: k + 1 },
    ]);
  }
  if (memberIds.length > limits.maxMembers) {
    return fail("invalid-input", [
      { memberId: "", code: "too-many-members", available: memberIds.length, required: limits.maxMembers },
    ]);
  }
  const seen = new Set<string>();
  for (const id of memberIds) {
    if (seen.has(id)) {
      reasons.push({ memberId: id, code: "duplicate-member", available: 0, required: 1 });
    }
    seen.add(id);
  }
  if (reasons.length) return fail("invalid-input", reasons);

  const unknown = unknownIds(memberIds, input.exclusions);
  if (unknown.length) {
    return fail(
      "invalid-input",
      unknown.map((memberId) => ({ memberId, code: "unknown-member" as const, available: 0, required: 1 })),
    );
  }

  const locked = normalizeSlots(input.locked ?? []);
  const lockError = validateLocked(memberIds, locked, k);
  if (lockError) return fail("invalid-input", lockError);

  const allowed = allowedGraph(memberIds, input.exclusions);
  const capacityReasons = capacityProblems(memberIds, allowed, k);
  if (capacityReasons.length) return fail("impossible", capacityReasons);

  const hardLocked = lockConflicts(allowed, locked);
  if (hardLocked.length) return fail("impossible", hardLocked);

  const order = shuffle(memberIds, rng);

  if (input.avoidReciprocal) {
    const strict = backtrack(order, allowed, k, true, locked, rng, nodeLimit);
    if (strict === "limit") {
      return fail("resource-limit", []);
    }
    if (strict) {
      const assignments = normalizeSlots(strict);
      const invalid = validateSolution(memberIds, k, allowed, assignments, true);
      if (invalid) return fail("impossible", invalid);
      return { ok: true, assignments, reciprocalPreferenceRelaxed: false, distribution: "randomized-backtracking" };
    }
  }

  const relaxed = backtrack(order, allowed, k, false, locked, rng, nodeLimit);
  if (Array.isArray(relaxed)) {
    const assignments = normalizeSlots(relaxed);
    const invalid = validateSolution(memberIds, k, allowed, assignments, false);
    if (invalid) return fail("impossible", invalid);
    return {
      ok: true,
      assignments,
      reciprocalPreferenceRelaxed: input.avoidReciprocal,
      distribution: "randomized-backtracking",
    };
  }
  if (relaxed === "limit" && locked.length === 0 && allowFlow && !input.avoidReciprocal) {
    const flowed = maxFlow(memberIds, allowed, k, rng);
    if (flowed) {
      const assignments = normalizeSlots(flowed);
      const invalid = validateSolution(memberIds, k, allowed, assignments, false);
      if (!invalid) {
        return { ok: true, assignments, reciprocalPreferenceRelaxed: false, distribution: "randomized-flow" };
      }
    }
    return fail("resource-limit", []);
  }
  if (relaxed === "limit") return fail("resource-limit", []);
  return fail("impossible", capacityReasons);
}

export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = swap;
  }
  return arr;
}

export function validateSolution(
  memberIds: string[],
  k: number,
  allowed: Map<string, Set<string>>,
  assignments: Assignment[],
  forbidReciprocal: boolean,
): DrawReason[] | null {
  if (assignments.length !== memberIds.length * k) {
    return [{ memberId: "", code: "not-enough-recipients", available: assignments.length, required: memberIds.length * k }];
  }
  const out = new Map<string, number>();
  const inn = new Map<string, number>();
  const pairs = new Set<string>();
  for (const id of memberIds) {
    out.set(id, 0);
    inn.set(id, 0);
  }
  for (const edge of assignments) {
    if (edge.giverId === edge.recipientId) {
      return [{ memberId: edge.giverId, code: "not-enough-recipients", available: 0, required: k }];
    }
    if (!allowed.get(edge.giverId)?.has(edge.recipientId)) {
      return [{ memberId: edge.giverId, code: "not-enough-recipients", available: 0, required: k }];
    }
    const key = `${edge.giverId}->${edge.recipientId}`;
    if (pairs.has(key)) {
      return [{ memberId: edge.giverId, code: "not-enough-recipients", available: 0, required: k }];
    }
    pairs.add(key);
    out.set(edge.giverId, (out.get(edge.giverId) ?? 0) + 1);
    inn.set(edge.recipientId, (inn.get(edge.recipientId) ?? 0) + 1);
  }
  for (const id of memberIds) {
    if ((out.get(id) ?? 0) !== k || (inn.get(id) ?? 0) !== k) {
      return [{ memberId: id, code: "not-enough-recipients", available: out.get(id) ?? 0, required: k }];
    }
  }
  if (forbidReciprocal) {
    for (const edge of assignments) {
      if (pairs.has(`${edge.recipientId}->${edge.giverId}`)) {
        return [{ memberId: edge.giverId, code: "not-enough-recipients", available: 0, required: k }];
      }
    }
  }
  return null;
}

function fail(code: "invalid-input" | "impossible" | "resource-limit", reasons: DrawReason[]): DrawResult {
  return { ok: false, code, reasons };
}

function unknownIds(memberIds: string[], exclusions: Exclusion[]): string[] {
  const known = new Set(memberIds);
  const bad = new Set<string>();
  for (const ex of exclusions) {
    const ids =
      ex.kind === "group" ? ex.memberIds : ex.kind === "reciprocal" ? [ex.aId, ex.bId] : [ex.fromId, ex.toId];
    for (const id of ids) if (!known.has(id)) bad.add(id);
  }
  return [...bad];
}

function allowedGraph(memberIds: string[], exclusions: Exclusion[]): Map<string, Set<string>> {
  const allowed = new Map<string, Set<string>>();
  for (const id of memberIds) allowed.set(id, new Set(memberIds.filter((other) => other !== id)));
  for (const ex of exclusions) {
    if (ex.kind === "directional" || ex.kind === "history") allowed.get(ex.fromId)?.delete(ex.toId);
    if (ex.kind === "reciprocal") {
      allowed.get(ex.aId)?.delete(ex.bId);
      allowed.get(ex.bId)?.delete(ex.aId);
    }
    if (ex.kind === "group") {
      for (const a of ex.memberIds) {
        for (const b of ex.memberIds) if (a !== b) allowed.get(a)?.delete(b);
      }
    }
  }
  return allowed;
}

function capacityProblems(memberIds: string[], allowed: Map<string, Set<string>>, k: number): DrawReason[] {
  const reasons: DrawReason[] = [];
  const incoming = new Map<string, number>(memberIds.map((id) => [id, 0]));
  for (const id of memberIds) {
    const n = allowed.get(id)?.size ?? 0;
    if (n < k) reasons.push({ memberId: id, code: "not-enough-recipients", available: n, required: k });
    for (const target of allowed.get(id) ?? []) incoming.set(target, (incoming.get(target) ?? 0) + 1);
  }
  for (const id of memberIds) {
    const n = incoming.get(id) ?? 0;
    if (n < k) reasons.push({ memberId: id, code: "not-enough-givers", available: n, required: k });
  }
  return reasons;
}

function validateLocked(memberIds: string[], locked: Assignment[], k: number): DrawReason[] | null {
  const known = new Set(memberIds);
  const reasons: DrawReason[] = [];
  const count = new Map<string, number>();
  for (const edge of locked) {
    if (!known.has(edge.giverId) || !known.has(edge.recipientId)) {
      reasons.push({
        memberId: known.has(edge.giverId) ? edge.recipientId : edge.giverId,
        code: "locked-member-missing",
        available: 0,
        required: k,
      });
      continue;
    }
    count.set(edge.giverId, (count.get(edge.giverId) ?? 0) + 1);
    if ((count.get(edge.giverId) ?? 0) > k) {
      reasons.push({ memberId: edge.giverId, code: "locked-conflict", available: count.get(edge.giverId) ?? 0, required: k });
    }
  }
  return reasons.length ? reasons : null;
}

function lockConflicts(allowed: Map<string, Set<string>>, locked: Assignment[]): DrawReason[] {
  const reasons: DrawReason[] = [];
  for (const edge of locked) {
    if (edge.giverId === edge.recipientId || !allowed.get(edge.giverId)?.has(edge.recipientId)) {
      reasons.push({ memberId: edge.giverId, code: "locked-conflict", available: 0, required: 1 });
    }
  }
  return reasons;
}

function backtrack(
  order: string[],
  allowed: Map<string, Set<string>>,
  k: number,
  forbidReciprocal: boolean,
  locked: Assignment[],
  rng: () => number,
  nodeLimit: number,
): Assignment[] | "limit" | null {
  const outLeft = new Map(order.map((id) => [id, k]));
  const inLeft = new Map(order.map((id) => [id, k]));
  const chosen = new Map<string, Set<string>>(order.map((id) => [id, new Set()]));
  const result: Assignment[] = [];

  for (const edge of locked) {
    if ((outLeft.get(edge.giverId) ?? 0) <= 0 || (inLeft.get(edge.recipientId) ?? 0) <= 0) return null;
    if (chosen.get(edge.giverId)?.has(edge.recipientId)) return null;
    outLeft.set(edge.giverId, (outLeft.get(edge.giverId) ?? 0) - 1);
    inLeft.set(edge.recipientId, (inLeft.get(edge.recipientId) ?? 0) - 1);
    chosen.get(edge.giverId)?.add(edge.recipientId);
    result.push(edge);
  }
  if (forbidReciprocal) {
    for (const edge of locked) {
      if (chosen.get(edge.recipientId)?.has(edge.giverId)) return null;
    }
  }

  const floor = result.length;
  let nodes = 0;

  function options(giver: string): string[] {
    const list: string[] = [];
    for (const recipient of allowed.get(giver) ?? []) {
      if ((inLeft.get(recipient) ?? 0) <= 0) continue;
      if (chosen.get(giver)?.has(recipient)) continue;
      if (forbidReciprocal && chosen.get(recipient)?.has(giver)) continue;
      list.push(recipient);
    }
    return list;
  }

  function pickGiver(): string | null {
    let best: string | null = null;
    let bestCount = Number.POSITIVE_INFINITY;
    for (const id of order) {
      if ((outLeft.get(id) ?? 0) <= 0) continue;
      const count = options(id).length;
      if (count < bestCount) {
        bestCount = count;
        best = id;
      }
    }
    return best;
  }

  function dfs(): boolean | "limit" {
    nodes += 1;
    if (nodes > nodeLimit) return "limit";
    const giver = pickGiver();
    if (!giver) return true;
    const choices = shuffle(options(giver), rng);
    if (choices.length === 0) return false;
    for (const recipient of choices) {
      outLeft.set(giver, (outLeft.get(giver) ?? 0) - 1);
      inLeft.set(recipient, (inLeft.get(recipient) ?? 0) - 1);
      chosen.get(giver)?.add(recipient);
      result.push({ giverId: giver, recipientId: recipient, slot: k - (outLeft.get(giver) ?? 0) });
      const next = dfs();
      if (next === true || next === "limit") return next;
      result.pop();
      chosen.get(giver)?.delete(recipient);
      outLeft.set(giver, (outLeft.get(giver) ?? 0) + 1);
      inLeft.set(recipient, (inLeft.get(recipient) ?? 0) + 1);
    }
    return false;
  }

  const done = dfs();
  if (done === "limit") return "limit";
  if (!done) return null;
  return result.slice(0, result.length).filter((_, index) => index >= 0 && (index < floor || index >= floor));
}

function maxFlow(
  memberIds: string[],
  allowed: Map<string, Set<string>>,
  k: number,
  rng: () => number,
): Assignment[] | null {
  const adj = new Map<string, Map<string, number>>();
  const link = (from: string, to: string, capacity: number) => {
    if (!adj.has(from)) adj.set(from, new Map());
    if (!adj.has(to)) adj.set(to, new Map());
    adj.get(from)?.set(to, (adj.get(from)?.get(to) ?? 0) + capacity);
    if (!adj.get(to)?.has(from)) adj.get(to)?.set(from, 0);
  };
  for (const id of memberIds) {
    link("S", `G:${id}`, k);
    link(`R:${id}`, "T", k);
    for (const recipient of shuffle([...(allowed.get(id) ?? [])], rng)) link(`G:${id}`, `R:${recipient}`, 1);
  }

  const dfs = (node: string, flow: number, seen: Set<string>): number => {
    if (node === "T") return flow;
    seen.add(node);
    for (const next of shuffle([...(adj.get(node)?.keys() ?? [])], rng)) {
      const capacity = adj.get(node)?.get(next) ?? 0;
      if (capacity <= 0 || seen.has(next)) continue;
      const pushed = dfs(next, Math.min(flow, capacity), seen);
      if (pushed > 0) {
        adj.get(node)?.set(next, capacity - pushed);
        adj.get(next)?.set(node, (adj.get(next)?.get(node) ?? 0) + pushed);
        return pushed;
      }
    }
    return 0;
  };

  let total = 0;
  const target = memberIds.length * k;
  let guard = 0;
  while (total < target && guard < target + 5) {
    const pushed = dfs("S", target - total, new Set());
    if (pushed <= 0) break;
    total += pushed;
    guard += 1;
  }
  if (total !== target) return null;

  const assignments: Assignment[] = [];
  for (const id of memberIds) {
    for (const [node, reverse] of adj.get(`R:${id}`) ?? []) {
      if (node.startsWith("G:") && reverse > 0) {
        assignments.push({ giverId: node.slice(2), recipientId: id, slot: 1 });
      }
    }
  }
  return assignments.length === target ? assignments : null;
}

function normalizeSlots(assignments: Assignment[]): Assignment[] {
  const groups = new Map<string, Assignment[]>();
  for (const edge of assignments) {
    const list = groups.get(edge.giverId) ?? [];
    list.push(edge);
    groups.set(edge.giverId, list);
  }
  const normalized: Assignment[] = [];
  for (const list of groups.values()) {
    list.forEach((edge, index) => normalized.push({ ...edge, slot: index + 1 }));
  }
  return normalized;
}

export function pairsOf(assignments: Assignment[]): Set<string> {
  return new Set(assignments.map((edge) => `${edge.giverId}->${edge.recipientId}`));
}

export function explainDrawFailure(reasons: DrawReason[], names: Map<string, string>): string[] {
  if (reasons.length === 0) {
    return ["Le calcul a atteint sa limite avant de trouver un tirage publiable. Simplifiez les contraintes, puis relancez. Aucun résultat partiel n'a été enregistré."];
  }
  return reasons.map((reason) => {
    const name = names.get(reason.memberId) || "Un participant";
    const people = (n: number) => (n > 1 ? `${n} personnes` : `${n} personne`);
    if (reason.code === "too-few-members") {
      return `Il faut au moins ${people(reason.required)} pour ${reason.required - 1} cadeau par personne. Le groupe en compte ${reason.available}.`;
    }
    if (reason.code === "too-many-members") return `Le groupe dépasse la limite de ${reason.required} participants.`;
    if (reason.code === "invalid-k") return "Le nombre de cadeaux par personne doit être compris entre 1 et 5.";
    if (reason.code === "duplicate-member") return "Un identifiant de participant est en double.";
    if (reason.code === "unknown-member") return "Une contrainte cite une personne qui n'est plus dans le groupe.";
    if (reason.code === "locked-member-missing") {
      return `${name} a déjà découvert une attribution qui disparaîtrait avec ce changement. L'opération est refusée.`;
    }
    if (reason.code === "locked-conflict") {
      return `Une attribution déjà découverte de ${name} ne peut plus être satisfaite. Aucune réattribution silencieuse n'a été faite.`;
    }
    if (reason.code === "not-enough-givers") {
      return `${name} ne peut recevoir un cadeau que de ${people(reason.available)}, et il en faut ${reason.required}.`;
    }
    return `${name} ne peut offrir qu'à ${people(reason.available)}, et il en faut ${reason.required}.`;
  });
}
