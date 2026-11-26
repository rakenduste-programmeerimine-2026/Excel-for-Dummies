import { afterEach, describe, expect, it, vi } from 'vitest';
import { authErrorMessage, signIn, signOut, signUp } from '@/lib/actions/auth';
import type { Supabase } from '@/lib/queries';

afterEach(() => vi.restoreAllMocks());

type Calls = { signUp?: unknown; signInWithPassword?: unknown };
function fakeAuth(results: { signUp?: unknown; signInWithPassword?: unknown; signOut?: unknown } = {}) {
  const calls: Calls = {};
  const client = {
    auth: {
      signUp: (args: unknown) => ((calls.signUp = args), Promise.resolve(results.signUp ?? { data: { user: { identities: [{}] }, session: null }, error: null })),
      signInWithPassword: (args: unknown) => ((calls.signInWithPassword = args), Promise.resolve(results.signInWithPassword ?? { data: {}, error: null })),
      signOut: () => Promise.resolve(results.signOut ?? { error: null }),
    },
  };
  return { client: client as unknown as Supabase, calls };
}
const authError = (code: string, status = 400) => ({ data: { user: null, session: null }, error: { code, status, message: code } });
const REDIRECT = 'https://app.example/auth/confirm?next=/projects';

describe('signUp', () => {
  it('creates the account with a normalised email and the confirmation link', async () => {
    const { client, calls } = fakeAuth();
    expect(await signUp(client, { email: '  Mari@Example.EE ', password: 'saladus123' }, REDIRECT)).toEqual({ ok: true, data: { needsConfirmation: true } });
    expect(calls.signUp).toEqual({ email: 'mari@example.ee', password: 'saladus123', options: { emailRedirectTo: REDIRECT } });
  });

  it('reports no confirmation needed when Supabase signs the user in right away', async () => {
    const { client } = fakeAuth({ signUp: { data: { user: { identities: [{}] }, session: { access_token: 'x' } }, error: null } });
    expect(await signUp(client, { email: 'a@b.ee', password: 'saladus123' }, REDIRECT)).toEqual({ ok: true, data: { needsConfirmation: false } });
  });

  it('detects an existing account even when Supabase hides it (user without identities)', async () => {
    const { client } = fakeAuth({ signUp: { data: { user: { identities: [] }, session: null }, error: null } });
    expect(await signUp(client, { email: 'a@b.ee', password: 'saladus123' }, REDIRECT)).toEqual({
      ok: false,
      error: 'Selle e-posti aadressiga konto on juba olemas. Logi sisse.',
    });
  });

  it('validates email and password length in Estonian before calling Supabase', async () => {
    const { client, calls } = fakeAuth();
    expect(await signUp(client, { email: 'pole-email', password: 'saladus123' }, REDIRECT)).toMatchObject({ ok: false, fieldErrors: { email: 'Sisesta korrektne e-posti aadress.' } });
    expect(await signUp(client, { email: 'a@b.ee', password: 'lühike' }, REDIRECT)).toMatchObject({ ok: false, fieldErrors: { password: 'Parool peab olema vähemalt 8 märki pikk.' } });
    expect(calls.signUp).toBeUndefined();
  });

  it('translates Supabase errors', async () => {
    expect(await signUp(fakeAuth({ signUp: authError('weak_password', 422) }).client, { email: 'a@b.ee', password: 'saladus123' }, REDIRECT)).toEqual({
      ok: false,
      error: 'Parool on liiga nõrk. Kasuta pikemat parooli, kus on tähti ja numbreid.',
    });
  });
});

describe('signIn', () => {
  it('signs in with a normalised email', async () => {
    const { client, calls } = fakeAuth();
    expect(await signIn(client, { email: ' Mari@Example.ee', password: 'x' })).toEqual({ ok: true, data: null });
    expect(calls.signInWithPassword).toEqual({ email: 'mari@example.ee', password: 'x' });
  });

  it('wrong password -> Estonian message, not logged as a server error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await signIn(fakeAuth({ signInWithPassword: authError('invalid_credentials') }).client, { email: 'a@b.ee', password: 'x' })).toEqual({
      ok: false,
      error: 'Vale e-posti aadress või parool.',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks for a password', async () => {
    expect(await signIn(fakeAuth().client, { email: 'a@b.ee', password: '' })).toMatchObject({ ok: false, error: 'Sisesta parool.' });
  });
});

describe('signOut', () => {
  it('signs out; an unexpected error is logged and shown generically', async () => {
    expect(await signOut(fakeAuth().client)).toEqual({ ok: true, data: null });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await signOut(fakeAuth({ signOut: { error: { code: 'unexpected_failure', status: 500 } } }).client)).toEqual({
      ok: false,
      error: 'Midagi läks valesti. Palun proovi uuesti.',
    });
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('authErrorMessage', () => {
  it.each([
    ['invalid_credentials', 'Vale e-posti aadress või parool.'],
    ['email_not_confirmed', 'Kinnita oma e-posti aadress. Saatsime sulle kinnituslingi.'],
    ['user_already_exists', 'Selle e-posti aadressiga konto on juba olemas. Logi sisse.'],
    ['email_exists', 'Selle e-posti aadressiga konto on juba olemas. Logi sisse.'],
    ['weak_password', 'Parool on liiga nõrk. Kasuta pikemat parooli, kus on tähti ja numbreid.'],
    ['email_address_invalid', 'Sisesta korrektne e-posti aadress.'],
    ['over_request_rate_limit', 'Liiga palju katseid. Proovi mõne minuti pärast uuesti.'],
    ['over_email_send_rate_limit', 'Liiga palju katseid. Proovi mõne minuti pärast uuesti.'],
    ['signup_disabled', 'Uute kontode loomine on praegu suletud.'],
    ['something_new', 'Midagi läks valesti. Palun proovi uuesti.'],
  ])('%s -> %s', (code, message) => expect(authErrorMessage({ code })).toBe(message));

  it('treats HTTP 429 without a code as too many attempts', () => {
    expect(authErrorMessage({ status: 429 })).toBe('Liiga palju katseid. Proovi mõne minuti pärast uuesti.');
  });
});
