import { describe, expect, it } from "vitest";
import { mergeParticipants, type RosterPerson } from "@shared/roster";

const person = (partial: Partial<RosterPerson> & Pick<RosterPerson, "displayName">): RosterPerson => ({
  email: "",
  groupLabel: "",
  ...partial,
});

describe("reprise des participants", () => {
  it("recopie les adresses et ignore l'organisateur", () => {
    const result = mergeParticipants([], [
      person({ memberId: "org-1", displayName: "Camille", email: "camille@example.com", role: "organizer" }),
      person({ memberId: "p-1", displayName: "Léa", email: "lea@example.com", groupLabel: "bureau" }),
      person({ memberId: "p-2", displayName: "Noé", email: "" }),
    ], "org-ici");
    expect(result.added).toBe(2);
    expect(result.members.map((item) => item.displayName)).toEqual(["Léa", "Noé"]);
    expect(result.members[0]?.email).toBe("lea@example.com");
    expect(result.members[0]?.groupLabel).toBe("bureau");
    expect(result.members[0]?.memberId).not.toBe("p-1");
  });

  it("ne recopie pas une adresse déjà présente et rattache l'enfant à l'adulte déjà là", () => {
    const current = [person({ memberId: "adulte-ici", displayName: "Sam", email: "sam@example.com" })];
    const result = mergeParticipants(current, [
      person({ memberId: "adulte-la", displayName: "Samuel", email: "sam@example.com" }),
      person({ memberId: "enfant-la", displayName: "Lou", email: "", managedByMemberId: "adulte-la" }),
      person({ memberId: "org-la", displayName: "Camille", email: "camille@example.com", role: "organizer" }),
      person({ memberId: "enfant-org", displayName: "Jo", email: "", managedByMemberId: "org-la" }),
    ], "org-ici");
    expect(result.added).toBe(2);
    expect(result.members.find((item) => item.displayName === "Lou")?.managedByMemberId).toBe("adulte-ici");
    expect(result.members.find((item) => item.displayName === "Jo")?.managedByMemberId).toBe("org-ici");
    expect(result.members.filter((item) => item.email === "sam@example.com")).toHaveLength(1);
  });
});
