import { exportProject } from '@/lib/exportProject';
import { createClient } from '@/lib/supabase/server';

// exceljs needs Node.js APIs, and every download is user-specific.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return exportProject(await createClient(), id);
}
