export interface GiftIdeaRecord {
  id: string;
  aboutMemberId: string;
  authorMemberId: string;
  authorName: string;
  text: string;
}

/** L'auteur revoit ses notes. La personne qui a tiré le destinataire voit toutes les notes le concernant. La personne concernée ne les voit pas. */
export function ideasForViewer(input: {
  viewerMemberId: string;
  recipientIds: string[];
  ideas: GiftIdeaRecord[];
}): { mine: GiftIdeaRecord[]; forRecipients: GiftIdeaRecord[] } {
  const recipients = new Set(input.recipientIds.filter((id) => id !== input.viewerMemberId));
  const mine = input.ideas.filter(
    (idea) => idea.authorMemberId === input.viewerMemberId && idea.aboutMemberId !== input.viewerMemberId,
  );
  const forRecipients = input.ideas.filter(
    (idea) => recipients.has(idea.aboutMemberId) && idea.aboutMemberId !== input.viewerMemberId,
  );
  return { mine, forRecipients };
}
