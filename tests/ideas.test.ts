import { describe, expect, it } from "vitest";
import { ideasForViewer, type GiftIdeaRecord } from "@shared/ideas";

const idea = (partial: Partial<GiftIdeaRecord> & Pick<GiftIdeaRecord, "id" | "aboutMemberId" | "authorMemberId">): GiftIdeaRecord => ({
  authorName: partial.authorMemberId,
  text: "une idée",
  ...partial,
});

describe("idées cadeau", () => {
  const ideas = [
    idea({ id: "1", aboutMemberId: "julie", authorMemberId: "christian", authorName: "Christian", text: "Un appareil photo" }),
    idea({ id: "2", aboutMemberId: "sylvie", authorMemberId: "julie", authorName: "Julie", text: "Un livre" }),
    idea({ id: "3", aboutMemberId: "julie", authorMemberId: "julie", authorName: "Julie", text: "Secret" }),
  ];

  it("montre à Coralie l'idée de Christian sur Julie, pas celle qui concerne quelqu'un d'autre", () => {
    const seen = ideasForViewer({ viewerMemberId: "coralie", recipientIds: ["julie"], ideas });
    expect(seen.forRecipients.map((item) => item.id)).toEqual(["1", "3"]);
    expect(seen.forRecipients.some((item) => item.aboutMemberId === "sylvie")).toBe(false);
    expect(seen.mine).toEqual([]);
  });

  it("laisse Christian revoir sa note sans lui montrer les autres idées", () => {
    const seen = ideasForViewer({ viewerMemberId: "christian", recipientIds: ["sylvie"], ideas });
    expect(seen.mine.map((item) => item.text)).toEqual(["Un appareil photo"]);
    expect(seen.forRecipients.map((item) => item.id)).toEqual(["2"]);
  });

  it("cache à Julie les idées écrites sur elle", () => {
    const seen = ideasForViewer({ viewerMemberId: "julie", recipientIds: ["sylvie"], ideas });
    expect(seen.forRecipients.map((item) => item.aboutMemberId)).toEqual(["sylvie"]);
    expect(seen.mine.map((item) => item.aboutMemberId)).not.toContain("julie");
    expect(seen.forRecipients.some((item) => item.aboutMemberId === "julie")).toBe(false);
  });
});
