export interface ImportedMember {
  displayName: string;
  email: string;
  groupLabel: string;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export function sanitizeSpreadsheetCell(value: string): string {
  const text = value.replace(/[\r\n]/g, " ").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function mapTabular(
  headers: string[],
  rows: string[][],
  mapping: { displayName: string; email: string; group: string },
): { members: ImportedMember[]; errors: ImportIssue[]; warnings: ImportIssue[] } {
  const nameIndex = headers.indexOf(mapping.displayName);
  const emailIndex = mapping.email ? headers.indexOf(mapping.email) : -1;
  const groupIndex = mapping.group ? headers.indexOf(mapping.group) : -1;
  if (nameIndex < 0) {
    return { members: [], errors: [{ row: 1, message: "Choisissez la colonne du prénom ou du pseudonyme." }], warnings: [] };
  }
  const members: ImportedMember[] = [];
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const emails = new Map<string, number>();
  const names = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const displayName = (row[nameIndex] ?? "").trim();
    const email = (emailIndex >= 0 ? (row[emailIndex] ?? "") : "").trim().toLowerCase();
    const groupLabel = (groupIndex >= 0 ? (row[groupIndex] ?? "") : "").trim();
    if (!displayName && !email && !groupLabel) return;
    if (!displayName) {
      errors.push({ row: rowNumber, message: "Le prénom ou le pseudonyme est vide." });
      return;
    }
    if (displayName.length > 80) {
      errors.push({ row: rowNumber, message: "Le nom dépasse 80 caractères." });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNumber, message: "L'adresse e-mail est invalide." });
      return;
    }
    if (email && emails.has(email)) {
      errors.push({ row: rowNumber, message: `Cette adresse est déjà utilisée à la ligne ${emails.get(email)}.` });
      return;
    }
    if (email) emails.set(email, rowNumber);
    const nameKey = displayName.toLocaleLowerCase("fr-FR");
    if (names.has(nameKey)) {
      warnings.push({
        row: rowNumber,
        message: "Ce prénom existe déjà. Les deux personnes resteront distinctes grâce à leur identifiant.",
      });
    }
    names.set(nameKey, rowNumber);
    members.push({ displayName, email, groupLabel });
  });

  return { members, errors, warnings };
}
