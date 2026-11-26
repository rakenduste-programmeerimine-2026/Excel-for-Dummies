import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIRM_FAILED, confirmEmail, safeNext } from '@/lib/auth/confirm';
import type { Supabase } from '@/lib/queries';

afterEach(() => vi.restoreAllMocks());

function fakeAuth(error: unknown = null) {
  const calls: { exchange?: string; verify?: unknown } = {};
  const client = {
    auth: {
      exchangeCodeForSession: (code: string) => ((calls.exchange = code), Promise.resolve({ data: {}, error })),
      verifyOtp: (args: unknown) => ((calls.verify = args), Promise.resolve({ data: {}, error })),
    },
  };
  return { client: client as unknown as Supabase, calls };
}
const url = (query: string) => new URL(`https://app.example/auth/confirm?${query}`);

describe('confirmEmail', () => {
  it('default email template: exchanges ?code= for a session and goes to next', async () => {
    const { client, calls } = fakeAuth();
    expect(await confirmEmail(client, url('code=abc&next=/projects'))).toBe('/projects');
    expect(calls.exchange).toBe('abc');
  });

  it('custom template: verifies ?token_hash=&type=', async () => {
    const { client, calls } = fakeAuth();
    expect(await confirmEmail(client, url('token_hash=h1&type=email&next=/projects/123'))).toBe('/projects/123');
    expect(calls.verify).toEqual({ token_hash: 'h1', type: 'email' });
  });

  it('goes to /projects when next is missing', async () => {
    expect(await confirmEmail(fakeAuth().client, url('code=abc'))).toBe('/projects');
  });

  it('sends expired or invalid links to the login page with an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await confirmEmail(fakeAuth({ code: 'otp_expired' }).client, url('code=abc'))).toBe(CONFIRM_FAILED);
    expect(await confirmEmail(fakeAuth({ code: 'otp_expired' }).client, url('token_hash=h&type=email'))).toBe(CONFIRM_FAILED);
    expect(await confirmEmail(fakeAuth().client, url('token_hash=h&type=hack'))).toBe(CONFIRM_FAILED);
    expect(await confirmEmail(fakeAuth().client, url(''))).toBe(CONFIRM_FAILED);
    expect(CONFIRM_FAILED).toBe('/login?error=confirm');
  });
});

describe('safeNext: no redirects to other sites', () => {
  it.each([
    ['/projects/1', '/projects/1'],
    [null, '/projects'],
    ['', '/projects'],
    ['https://evil.example', '/projects'],
    ['//evil.example', '/projects'],
    ['/\\evil.example', '/projects'],
    ['projects', '/projects'],
  ])('%s -> %s', (next, expected) => expect(safeNext(next)).toBe(expected));
});
