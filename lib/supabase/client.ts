'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types.db';
import { supabaseEnv } from './env';

/** Supabase client for client components (login form etc.). Uses the anon key only. */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
