import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
};
let adapter: CookieAdapter | undefined;
let onGetClaims: () => void = () => {};

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieAdapter }) => {
    adapter = options.cookies;
    return { auth: { getClaims: async () => (onGetClaims(), { data: null, error: null }) } };
  },
}));

const { updateSession } = await import('@/lib/supabase/proxy');
const { config } = await import('@/proxy');

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  adapter = undefined;
  onGetClaims = () => {};
});

const request = (cookie = '') => new NextRequest('https://app.example/projects', { headers: cookie ? { cookie } : {} });

describe('updateSession (proxy.ts)', () => {
  it('passes the request through and reads the session cookies', async () => {
    let seen: { name: string; value: string }[] = [];
    onGetClaims = () => (seen = adapter!.getAll());
    const response = await updateSession(request('sb-auth-token=old'));
    expect(seen).toEqual([{ name: 'sb-auth-token', value: 'old' }]);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.cookies.getAll()).toEqual([]);
  });

  it('writes a refreshed session to the response (browser) and the request (this render)', async () => {
    onGetClaims = () => adapter!.setAll([{ name: 'sb-auth-token', value: 'new', options: { httpOnly: true, path: '/' } }]);
    const req = request('sb-auth-token=old');
    const response = await updateSession(req);
    expect(response.cookies.get('sb-auth-token')).toMatchObject({ value: 'new', httpOnly: true, path: '/' });
    expect(req.cookies.get('sb-auth-token')?.value).toBe('new');
  });

  it('without Supabase settings, lets every page through and warns once instead of crashing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = await updateSession(request());
    await updateSession(request());
    expect(first.headers.get('x-middleware-next')).toBe('1');
    expect(adapter).toBeUndefined(); // no Supabase client created
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('runs on pages and API routes but not on static files', () => {
    const matcher = new RegExp(`^${config.matcher[0]!.replace('/:path*', '')}$`);
    expect(matcher.test('/projects/123')).toBe(true);
    expect(matcher.test('/api/projects/1/export')).toBe(true);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/logo.png')).toBe(false);
  });
});
