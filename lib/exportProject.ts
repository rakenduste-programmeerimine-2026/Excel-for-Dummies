import 'server-only';
import { buildWorkbook } from '@/lib/excel/buildWorkbook';
import { contentDisposition, exportFileName } from '@/lib/excel/fileName';
import { getProjectForExport, type Supabase } from '@/lib/queries';
import { api } from '@/lib/strings.et';

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * GET /api/projects/[id]/export
 * 401 when signed out; 404 when the project doesn't exist or RLS hides it (the two look the same,
 * so nobody can probe for other users' projects); otherwise the .xlsx download.
 */
export async function exportProject(supabase: Supabase, projectId: string, now: Date = new Date()): Promise<Response> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return errorResponse(401, api.notSignedIn);
  if (!UUID.test(projectId)) return errorResponse(404, api.projectNotFound);

  try {
    const data = await getProjectForExport(supabase, projectId);
    if (!data) return errorResponse(404, api.projectNotFound);

    const file = await buildWorkbook({ ...data, exportDate: now });
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': contentDisposition(exportFileName(data.project.name, now)),
        'Content-Length': String(file.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Export failed', { projectId, error });
    return errorResponse(500, api.exportFailed);
  }
}
