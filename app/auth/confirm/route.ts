import { NextResponse, type NextRequest } from 'next/server';
import { confirmEmail } from '@/lib/auth/confirm';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** The link in the confirmation email: signs the user in and sends them on (or to /login?error=confirm). */
export async function GET(request: NextRequest) {
  const path = await confirmEmail(await createClient(), new URL(request.url));
  return NextResponse.redirect(new URL(path, request.url));
}
