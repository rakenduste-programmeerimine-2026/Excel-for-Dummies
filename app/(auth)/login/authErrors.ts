import { ui } from '@/lib/strings.et';

const t = ui.auth.errors;

// Must match minimum_password_length in supabase/config.toml (and the hosted project's setting).
export const MIN_PASSWORD_LENGTH = 6;

/** Turns a Supabase Auth error into Estonian text. Supabase's own messages are English, so never show them. */
export function authErrorMessage(error: { code?: string; name?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return t.invalidCredentials;
    case 'user_already_exists':
    case 'email_exists':
      return t.userExists;
    case 'weak_password':
      return t.weakPassword;
    case 'email_not_confirmed':
      return t.emailNotConfirmed;
    case 'email_address_invalid':
      return t.emailInvalid;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t.rateLimit;
  }
  // The request never reached Supabase (offline, server down).
  if (error.name === 'AuthRetryableFetchError') return t.network;
  return t.unknown;
}
