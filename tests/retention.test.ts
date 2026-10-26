import { describe, expect, test } from "vitest";
import { organizerCanCloseAccount } from "../shared/retention";
import {
  accessEndInstant,
  accountPhase,
  addCalendarMonths,
  draftPhase,
  invitationPurgeAt,
  nextAccessUntil,
  retentionPhase,
} from "../shared/retention";

describe("conservation", () => {
  test("la fin d'accès est douze mois après la date, à 23 h 59 dans le fuseau", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    const end = accessEndInstant("2026-10-22", "Europe/Paris");
    expect(end.toISOString()).toBe("2027-10-22T21:59:00.000Z");
  });

  test("un report ne repousse pas une fin d'accès déjà fixée", () => {
    const current = accessEndInstant("2026-12-01", "Europe/Paris");
    const later = nextAccessUntil({
      currentUntil: current,
      locked: true,
      nextLocalDate: "2027-06-01",
      timeZone: "Europe/Paris",
    });
    expect(later.refused).toMatch(/report/);
    expect(later.until.toISOString()).toBe(current.toISOString());
    const earlier = nextAccessUntil({
      currentUntil: current,
      locked: false,
      nextLocalDate: "2026-11-01",
      timeZone: "Europe/Paris",
    });
    expect(earlier.refused).toBeNull();
    expect(earlier.until.getTime()).toBeLessThan(current.getTime());
  });

  test("avertissement trente jours avant, suppression à l'échéance", () => {
    const end = accessEndInstant("2026-10-22", "Europe/Paris");
    expect(retentionPhase(end, new Date(end.getTime() - 31 * 24 * 60 * 60 * 1000))).toBe("open");
    expect(retentionPhase(end, new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000))).toBe("warning");
    expect(retentionPhase(end, end)).toBe("due");
  });

  test("brouillon, invitation et compte inactif suivent les délais", () => {
    const updated = new Date("2026-01-15T00:00:00.000Z");
    expect(draftPhase(updated, new Date("2026-06-14T00:00:00.000Z"))).toBe("keep");
    expect(draftPhase(updated, new Date("2026-06-15T00:00:00.000Z"))).toBe("warn");
    expect(draftPhase(updated, new Date("2026-07-15T00:00:00.000Z"))).toBe("delete");
    const expires = Date.parse("2026-01-01T00:00:00.000Z");
    expect(invitationPurgeAt(expires) - expires).toBe(60 * 24 * 60 * 60 * 1000);
    const seen = new Date("2024-01-01T00:00:00.000Z");
    const warned = new Date("2026-01-01T00:00:00.000Z");
    expect(accountPhase({ lastSeenAt: seen, warnedAt: null, now: warned })).toBe("warn");
    expect(accountPhase({ lastSeenAt: seen, warnedAt: warned, now: new Date("2026-01-31T00:00:00.000Z") })).toBe("delete");
    expect(accountPhase({ lastSeenAt: new Date("2026-01-20T00:00:00.000Z"), warnedAt: warned, now: new Date("2026-02-15T00:00:00.000Z") })).toBe("keep");
  });

  test("un organisateur d'un échange en cours ne laisse pas l'événement sans responsable", () => {
    expect(organizerCanCloseAccount(["archived", "cancelled"]).ok).toBe(true);
    const blocked = organizerCanCloseAccount(["drawn"]);
    expect(blocked.ok).toBe(false);
  });
});