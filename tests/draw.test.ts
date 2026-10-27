import { describe, expect, it } from "vitest";
import { decideLaunch } from "@shared/domain";
import { explainDrawFailure, pairsOf, solveDraw, validateSolution } from "@shared/draw/engine";
import { historyFromPast, personToken } from "@shared/draw/prior";

const couple = (a: string, b: string) => ({ kind: "reciprocal" as const, aId: a, bId: b });

function degrees(ids: string[], result: { giverId: string; recipientId: string }[]) {
  const out = new Map(ids.map((id) => [id, 0]));
  const inn = new Map(ids.map((id) => [id, 0]));
  for (const edge of result) {
    out.set(edge.giverId, (out.get(edge.giverId) ?? 0) + 1);
    inn.set(edge.recipientId, (inn.get(edge.recipientId) ?? 0) + 1);
  }
  return { out, inn };
}

describe("tirage", () => {
  it("respecte deux couples dans un groupe de six", () => {
    const ids = ["a1", "a2", "b1", "b2", "c1", "c2"];
    const result = solveDraw({
      memberIds: ids,
      giftsPerPerson: 1,
      avoidReciprocal: true,
      exclusions: [couple("a1", "a2"), couple("b1", "b2"), couple("c1", "c2")],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pairs = pairsOf(result.assignments);
    expect(pairs.has("a1->a2")).toBe(false);
    expect(pairs.has("a2->a1")).toBe(false);
    expect(pairs.has("b1->b2")).toBe(false);
    expect(pairs.has("c1->c2")).toBe(false);
    for (const id of ids) {
      expect(result.assignments.filter((edge) => edge.giverId === id)).toHaveLength(1);
      expect(result.assignments.filter((edge) => edge.recipientId === id)).toHaveLength(1);
      expect(result.assignments.some((edge) => edge.giverId === id && edge.recipientId === id)).toBe(false);
    }
  });

  it("réussit un groupe de trois et refuse un cas impossible sans résultat partiel", () => {
    const ok = solveDraw({
      memberIds: ["a", "b", "c"],
      giftsPerPerson: 1,
      avoidReciprocal: true,
      exclusions: [],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.reciprocalPreferenceRelaxed).toBe(false);

    const impossible = solveDraw({
      memberIds: ["a", "b", "c"],
      giftsPerPerson: 1,
      avoidReciprocal: false,
      exclusions: [{ kind: "group", memberIds: ["a", "b", "c"] }],
    });
    expect(impossible.ok).toBe(false);
    if (!impossible.ok) {
      expect(impossible).not.toHaveProperty("assignments");
      expect(explainDrawFailure(impossible.reasons, new Map([["a", "Awa"]])).join(" ")).toContain("Awa");
    }
  });

  it("applique une exclusion directionnelle et un degré k supérieur à 1", () => {
    const directed = solveDraw({
      memberIds: ["a", "b", "c", "d"],
      giftsPerPerson: 1,
      avoidReciprocal: false,
      exclusions: [{ kind: "directional", fromId: "a", toId: "b" }],
    });
    expect(directed.ok).toBe(true);
    if (directed.ok) expect(pairsOf(directed.assignments).has("a->b")).toBe(false);

    const ids = ["a", "b", "c", "d", "e"];
    const multi = solveDraw({ memberIds: ids, giftsPerPerson: 2, avoidReciprocal: false, exclusions: [] });
    expect(multi.ok).toBe(true);
    if (!multi.ok) return;
    const { out, inn } = degrees(ids, multi.assignments);
    for (const id of ids) {
      expect(out.get(id)).toBe(2);
      expect(inn.get(id)).toBe(2);
    }
    const unique = new Set(multi.assignments.map((edge) => `${edge.giverId}->${edge.recipientId}`));
    expect(unique.size).toBe(ids.length * 2);
  });

  it("signale qu'une préférence anti-réciprocité ne peut pas être tenue", () => {
    const result = solveDraw({
      memberIds: ["a", "b"],
      giftsPerPerson: 1,
      avoidReciprocal: true,
      exclusions: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reciprocalPreferenceRelaxed).toBe(true);
  });

  it("conserve une attribution déjà découverte lors d'un ajout", () => {
    const result = solveDraw({
      memberIds: ["a", "b", "c", "d"],
      giftsPerPerson: 1,
      avoidReciprocal: false,
      locked: [{ giverId: "a", recipientId: "b", slot: 1 }],
      exclusions: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(pairsOf(result.assignments).has("a->b")).toBe(true);
  });

  it("refuse de casser une attribution découverte pour ajouter une personne", () => {
    const result = solveDraw({
      memberIds: ["a", "b", "c", "d"],
      giftsPerPerson: 1,
      avoidReciprocal: false,
      locked: [
        { giverId: "a", recipientId: "b", slot: 1 },
        { giverId: "b", recipientId: "c", slot: 1 },
        { giverId: "c", recipientId: "a", slot: 1 },
      ],
      exclusions: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result).not.toHaveProperty("assignments");
  });

  it("s'arrête proprement quand le budget de recherche est épuisé", () => {
    const result = solveDraw({
      memberIds: ["a", "b", "c"],
      giftsPerPerson: 1,
      avoidReciprocal: true,
      exclusions: [],
      nodeLimit: 1,
      allowFlowFallback: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("resource-limit");
  });

  it("valide une solution complète", () => {
    const ids = ["a", "b", "c"];
    const allowed = new Map(ids.map((id) => [id, new Set(ids.filter((other) => other !== id))]));
    const assignments = [
      { giverId: "a", recipientId: "b", slot: 1 },
      { giverId: "b", recipientId: "c", slot: 1 },
      { giverId: "c", recipientId: "a", slot: 1 },
    ];
    expect(validateSolution(ids, 1, allowed, assignments, true)).toBeNull();
  });
});

describe("tirages précédents", () => {
  it("retrouve une paire par e-mail et ignore un homonyme sans adresse", () => {
    const current = [
      { memberId: "a", email: "a@exemple.fr", name: "Awa" },
      { memberId: "b", email: "b@exemple.fr", name: "Bo" },
      { memberId: "c", email: "", name: "Cam" },
      { memberId: "d", email: "", name: "Cam" },
    ];
    const past = historyFromPast(current, [
      { fromToken: personToken("a@exemple.fr", "Awa"), toToken: personToken("b@exemple.fr", "Bo") },
      { fromToken: personToken("", "Cam"), toToken: personToken("a@exemple.fr", "Awa") },
    ]);
    expect(past).toEqual([{ kind: "history", fromId: "a", toId: "b" }]);
    const solved = solveDraw({
      memberIds: ["a", "b", "c", "d"],
      giftsPerPerson: 1,
      avoidReciprocal: false,
      exclusions: past,
    });
    expect(solved.ok).toBe(true);
    if (solved.ok) expect(pairsOf(solved.assignments).has("a->b")).toBe(false);
  });
});

describe("lancement concurrent", () => {
  const ready = { status: "ready" as const, idempotencyKey: null, lockUntil: null };

  it("ne produit qu'une décision de tirage", () => {
    expect(decideLaunch(ready, "cle-1", 1_000)).toBe("proceed");
    expect(decideLaunch({ status: "drawn", idempotencyKey: "cle-1", lockUntil: null }, "cle-1", 2_000)).toBe("replay");
    expect(decideLaunch({ status: "drawn", idempotencyKey: "cle-1", lockUntil: null }, "cle-2", 2_000)).toBe("already-drawn");
    expect(decideLaunch({ ...ready, lockUntil: 5_000 }, "cle-3", 4_000)).toBe("busy");
    expect(decideLaunch({ status: "cancelled", idempotencyKey: null, lockUntil: null }, "cle", 1)).toBe("invalid-status");
  });
});
