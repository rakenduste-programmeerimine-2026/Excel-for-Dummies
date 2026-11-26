'use server';

import { headers } from 'next/headers';
import * as authActions from '@/lib/actions/auth';
import type { ActionResult } from '@/lib/actions/result';
import { createClient } from '@/lib/supabase/server';
import type { AuthInput } from '@/lib/validation';

// Auth server actions for the login / sign-up page (Frontend builds the page).
// They return a result; the page decides where to go next (e.g. router.push('/projects')).

/** The site's own address for the link in the confirmation email. */
async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export async function signUp(input: AuthInput): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  return authActions.signUp(await createClient(), input, `${await siteUrl()}/auth/confirm?next=/projects`);
}

export async function signIn(input: AuthInput): Promise<ActionResult> {
  return authActions.signIn(await createClient(), input);
}

export async function signOut(): Promise<ActionResult> {
  return authActions.signOut(await createClient());
}
