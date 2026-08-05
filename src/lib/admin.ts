// Whoever registers (or later logs in) with this exact email is the app's
// admin. Normalized on both sides here rather than trusted from the caller —
// SignupSchema/LoginSchema already trim+lowercase the submitted email, but
// ADMIN_EMAIL is hand-typed into a hosting panel by a human and can't be
// assumed clean.
export function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
