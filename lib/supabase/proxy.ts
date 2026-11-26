import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types.db';
import { supabaseEnv } from './env';

/**
 * Runs before every request (proxy.ts). Refreshes the Supabase session when its access token has
 * expired and writes the new cookies to both the request (for the page being rendered now) and the
 * response (for the browser). Without this, logins silently expire.
 */
let warned = false;

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // Without Supabase settings (e.g. a fresh clone with no .env.local) don't take every page down:
  // skip session handling and say why, once.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (!warned) console.warn('proxy.ts: Supabase is not configured (see .env.example); sessions are not refreshed.');
    warned = true;
    return response;
  }
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Validates the token and refreshes it if needed (calls setAll above). Don't put code between
  // createServerClient and this call, and always return `response` so the cookies reach the browser.
  await supabase.auth.getClaims();
  return response;
}
