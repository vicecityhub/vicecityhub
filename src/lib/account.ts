// Pure account helpers (no React, no Supabase): names derived from auth users and form validation.
// Extracted from Layout.tsx; messages and rules are unchanged.

export interface UserLike {
  email?: string | null;
  user_metadata?: { username?: string } | null;
}

/** Display name for a signed-in session: metadata username, else the e-mail local part. */
export function usernameFromUser(user: UserLike | null | undefined): string {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || '';
}

/** Display name right after a password login: metadata username, else the typed e-mail's local part. */
export function usernameFromLogin(user: UserLike | null | undefined, typedEmail: string): string {
  return user?.user_metadata?.username || typedEmail.split('@')[0];
}

export const MIN_PASSWORD_LENGTH = 6;

/** Returns the error message to show, or null when the input is fine. */
export function validateLogin(email: string, pass: string): string | null {
  return !email || !pass ? 'Enter email and password.' : null;
}

export function validateRegistration(user: string, email: string, pass: string, confirm: string): string | null {
  if (!user || !email || !pass) return 'All fields required.';
  if (pass.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 6 characters.';
  if (pass !== confirm) return 'Passwords do not match.';
  return null;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 6 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}
