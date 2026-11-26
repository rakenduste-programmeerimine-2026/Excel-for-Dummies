import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalcType } from '@/lib/calc';
import type { ExportData } from '@/lib/excel/types';
import type { Database, Json } from '@/lib/types.db';

export type Supabase = SupabaseClient<Database>;

/** numeric columns arrive as numbers from PostgREST, but may be strings; accept both. */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Not a number from the database: ${String(value)}`);
  return n;
}

/** rows.extra is { "<project_column_id>": "text" }. Anything else is ignored. */
export function toExtra(extra: Json): Record<string, string> {
  if (extra === null || typeof extra !== 'object' || Array.isArray(extra)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === 'string') result[key] = value;
    else if (typeof value === 'number') result[key] = String(value);
  }
  return result;
}

/**
 * Loads a project with its profile, extra columns and rows (sorted by position) for the export.
 * Runs as the signed-in user, so Row Level Security decides what is visible.
 * Returns null when the project doesn't exist or belongs to someone else.
 */
export async function getProjectForExport(supabase: Supabase, projectId: string): Promise<Omit<ExportData, 'exportDate'> | null> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id, name, client, address, tax_rate')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError) throw new Error(`Loading project failed: ${projectError.message}`);
  if (!project) return null;

  const [profile, columns, rows] = await Promise.all([
    supabase.from('profiles').select('business_name').eq('id', project.user_id).maybeSingle(),
    supabase.from('project_columns').select('id, name').eq('project_id', projectId).order('position'),
    supabase
      .from('rows')
      .select('date, description, calc_type, quantity, unit, unit_price, percent, extra')
      .eq('project_id', projectId)
      .order('position')
      .order('created_at'),
  ]);
  for (const [what, result] of [['profile', profile], ['columns', columns], ['rows', rows]] as const) {
    if (result.error) throw new Error(`Loading ${what} failed: ${result.error.message}`);
  }

  return {
    businessName: profile.data?.business_name ?? null,
    project: {
      name: project.name,
      client: project.client,
      address: project.address,
      tax_rate: toNumber(project.tax_rate) ?? 0,
    },
    columns: (columns.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    rows: (rows.data ?? []).map((r) => ({
      date: r.date,
      description: r.description,
      calc_type: r.calc_type as CalcType,
      quantity: toNumber(r.quantity),
      unit: r.unit,
      unit_price: toNumber(r.unit_price),
      percent: toNumber(r.percent),
      extra: toExtra(r.extra),
    })),
  };
}
