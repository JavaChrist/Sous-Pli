export interface RosterPerson {
  memberId?: string;
  displayName: string;
  email: string;
  groupLabel: string;
  managedByMemberId?: string | null;
  role?: string;
}

function mailOf(person: RosterPerson): string {
  return person.email.trim().toLowerCase();
}

/** Ajoute les personnes d'un autre échange. L'organisateur n'est pas recopié : il est déjà géré à part. Une adresse déjà présente est ignorée. */
export function mergeParticipants(
  current: RosterPerson[],
  incoming: RosterPerson[],
  organizerMemberId?: string | null,
): { members: RosterPerson[]; added: number } {
  const emails = new Set(current.map(mailOf).filter(Boolean));
  const idMap = new Map<string, string>();
  const added: RosterPerson[] = [];

  for (const person of incoming) {
    if (person.role === "organizer") {
      if (person.memberId && organizerMemberId) idMap.set(person.memberId, organizerMemberId);
      continue;
    }
    const email = mailOf(person);
    if (email && emails.has(email)) {
      const existing = current.find((item) => mailOf(item) === email);
      if (person.memberId && existing?.memberId) idMap.set(person.memberId, existing.memberId);
      continue;
    }
    const memberId = crypto.randomUUID();
    if (person.memberId) idMap.set(person.memberId, memberId);
    if (email) emails.add(email);
    added.push({
      memberId,
      displayName: person.displayName.trim(),
      email: person.email.trim(),
      groupLabel: person.groupLabel.trim(),
      managedByMemberId: person.managedByMemberId ?? null,
    });
  }

  const members = [
    ...current,
    ...added.map((person) => ({
      ...person,
      managedByMemberId: person.managedByMemberId ? idMap.get(person.managedByMemberId) ?? null : null,
    })),
  ];
  return { members, added: added.length };
}
