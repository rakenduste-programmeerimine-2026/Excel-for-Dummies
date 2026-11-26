import 'server-only';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { Supabase } from '@/lib/queries';

// GET /auth/confirm: the link in the sign-up (and other auth) emails lands here.
// Supports both link styles Supabase can send:
//   ?code=…                    the default email template (PKCE flow of @supabase/ssr)
//   ?token_hash=…&type=email   a custom template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email

export const DEFAULT_NEXT = '/projects';
export const CONFIRM_FAILED = '/login?error=confirm';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/** Only same-site paths, so the link can't be abused to redirect somewhere else. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return DEFAULT_NEXT;
  return next;
}

/** Verifies the link and returns the path to redirect to. */
export async function confirmEmail(supabase: Supabase, url: URL): Promise<string> {
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return next;
    console.error('Email confirmation failed (code)', error);
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return next;
    console.error('Email confirmation failed (token_hash)', error);
  }
  return CONFIRM_FAILED;
}
