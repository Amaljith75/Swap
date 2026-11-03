// Turns Supabase / network errors into a sentence a person can act on.
// Server functions already raise plain-language messages, so those pass through.
export function errorMessage(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : '';
  if (!raw) return 'Something went wrong. Try again.';
  if (/network request failed|failed to fetch|network error|timeout/i.test(raw)) {
    return 'No connection. Check your internet and try again.';
  }
  if (/jwt|refresh token|not authenticated/i.test(raw)) {
    return 'Your session expired. Sign in again.';
  }
  if (/permission denied|row-level security/i.test(raw)) {
    return 'You are not allowed to do that.';
  }
  if (/invalid login credentials/i.test(raw)) return 'Email or password is wrong.';
  if (/email not confirmed/i.test(raw)) return 'Confirm your email first. Check your inbox for the link.';
  if (/user already registered/i.test(raw)) return 'An account with this email already exists. Sign in instead.';
  if (/password should be/i.test(raw)) return 'Use a password with at least 6 characters.';
  return raw;
}
