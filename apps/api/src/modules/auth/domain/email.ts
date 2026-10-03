/** Emails são comparados e armazenados normalizados (o banco também exige minúsculas). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
