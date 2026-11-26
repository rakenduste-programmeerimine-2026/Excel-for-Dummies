import 'server-only';
import type { Supabase } from '@/lib/queries';
import { auth as t } from '@/lib/strings.et';
import { signInSchema, signUpSchema, type AuthInput } from '@/lib/validation';
import { fail, fromZodError, ok, type ActionResult } from './result';

// Logic of the auth server actions (app/(auth)/actions.ts wraps them).

type AuthErrorLike = { code?: string; message?: string; status?: number };

/** Supabase auth error codes -> one short Estonian sentence for the user. */
export function authErrorMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case 'invalid_credentials':
      return t.invalidCredentials;
    case 'email_not_confirmed':
      return t.emailNotConfirmed;
    case 'user_already_exists':
    case 'email_exists':
      return t.emailExists;
    case 'weak_password':
      return t.weakPassword;
    case 'email_address_invalid':
    case 'validation_failed':
      return t.invalidEmail;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t.tooManyAttempts;
    case 'signup_disabled':
    case 'email_provider_disabled':
      return t.signupDisabled;
    default:
      return error.status === 429 ? t.tooManyAttempts : t.failed;
  }
}

function authFailed(context: string, error: AuthErrorLike): ActionResult<never> {
  const message = authErrorMessage(error);
  // Expected user mistakes (wrong password …) aren't server errors; log only the unexpected ones.
  if (message === t.failed) console.error(`Auth failed: ${context}`, error);
  return fail(message);
}

/**
 * Creates an account. With email confirmation on (the Supabase default), the user must click the
 * link in the email first: `needsConfirmation` tells the UI to show "check your email".
 */
export async function signUp(supabase: Supabase, input: AuthInput, emailRedirectTo: string): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo } });
  if (error) return authFailed('signUp', error);
  // When confirmation is on, Supabase doesn't reveal that an email is taken: it returns a user
  // without identities instead of an error.
  if (data.user && data.user.identities?.length === 0) return fail(t.emailExists);
  return ok({ needsConfirmation: !data.session });
}

export async function signIn(supabase: Supabase, input: AuthInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return authFailed('signIn', error);
  return ok(null);
}

export async function signOut(supabase: Supabase): Promise<ActionResult> {
  const { error } = await supabase.auth.signOut();
  if (error) return authFailed('signOut', error);
  return ok(null);
}
