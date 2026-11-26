import type { SupabaseClient } from '@supabase/supabase-js';
import { calcProject, type CalcType } from '@/lib/calc';
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

// ---- rows -------------------------------------------------------------------------

type DbRow = Database['public']['Tables']['rows']['Row'];

/** A table row with numeric columns as numbers (used by the editor and the row actions). */
export type RowData = {
  id: string;
  project_id: string;
  position: number;
  date: string | null;
  description: string;
  calc_type: CalcType;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  percent: number | null;
  extra: Record<string, string>;
};

export const ROW_COLUMNS = 'id, project_id, position, date, description, calc_type, quantity, unit, unit_price, percent, extra, created_at';

export function toRowData(row: Pick<DbRow, keyof RowData>): RowData {
  return {
    id: row.id,
    project_id: row.project_id,
    position: row.position,
    date: row.date,
    description: row.description,
    calc_type: row.calc_type,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    unit_price: toNumber(row.unit_price),
    percent: toNumber(row.percent),
    extra: toExtra(row.extra),
  };
}

// ---- queries for the pages ----------------------------------------------------

export type ProjectSummary = {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  tax_rate: number;
  created_at: string | null;
  rowCount: number;
  /** Same numbers as the project page and the export (calcProject). */
  subtotal: number;
  tax: number;
  total: number;
};

/**
 * The signed-in user's projects for the /projects list, newest first, each with its totals.
 * Two queries in total (projects, then all their rows), however many projects there are.
 */
export async function listProjects(supabase: Supabase): Promise<ProjectSummary[]> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, client, address, tax_rate, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Loading projects failed: ${error.message}`);
  if (!projects?.length) return [];

  const { data: rows, error: rowsError } = await supabase
    .from('rows')
    .select('project_id, calc_type, quantity, unit_price, percent')
    .in(
      'project_id',
      projects.map((p) => p.id),
    )
    .order('position')
    .order('created_at');
  if (rowsError) throw new Error(`Loading rows failed: ${rowsError.message}`);

  const rowsByProject = new Map<string, { calc_type: CalcType; quantity: number | null; unit_price: number | null; percent: number | null }[]>();
  for (const r of rows ?? []) {
    const list = rowsByProject.get(r.project_id) ?? [];
    list.push({ calc_type: r.calc_type as CalcType, quantity: toNumber(r.quantity), unit_price: toNumber(r.unit_price), percent: toNumber(r.percent) });
    rowsByProject.set(r.project_id, list);
  }

  return projects.map((p) => {
    const projectRows = rowsByProject.get(p.id) ?? [];
    const taxRate = toNumber(p.tax_rate) ?? 0;
    const totals = calcProject(projectRows, taxRate);
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      address: p.address,
      tax_rate: taxRate,
      created_at: p.created_at,
      rowCount: projectRows.length,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
    };
  });
}

export type Profile = { business_name: string | null; default_tax_rate: number };

/** Business name and default käibemaks of the signed-in user (settings form). null when signed out. */
export async function getProfile(supabase: Supabase): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('profiles').select('business_name, default_tax_rate').eq('id', auth.user.id).maybeSingle();
  if (error) throw new Error(`Loading profile failed: ${error.message}`);
  if (!data) return null;
  return { business_name: data.business_name, default_tax_rate: toNumber(data.default_tax_rate) ?? 0 };
}

export type EditorProject = {
  project: { id: string; name: string; client: string | null; address: string | null; tax_rate: number };
  /** Extra text columns, left to right. */
  columns: { id: string; name: string; position: number }[];
  /** Rows in position order; numeric columns as numbers. */
  rows: RowData[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Everything the project page's table editor needs, including the extra columns.
 * null when the id is malformed, the project doesn't exist or RLS hides it.
 */
export async function getProjectForEditor(supabase: Supabase, projectId: string): Promise<EditorProject | null> {
  if (!UUID.test(projectId)) return null;
  const { data: project, error } = await supabase.from('projects').select('id, name, client, address, tax_rate').eq('id', projectId).maybeSingle();
  if (error) throw new Error(`Loading project failed: ${error.message}`);
  if (!project) return null;

  const [columns, rows] = await Promise.all([
    supabase.from('project_columns').select('id, name, position').eq('project_id', projectId).order('position'),
    supabase
      .from('rows')
      .select(ROW_COLUMNS)
      .eq('project_id', projectId)
      .order('position')
      .order('created_at'),
  ]);
  if (columns.error) throw new Error(`Loading columns failed: ${columns.error.message}`);
  if (rows.error) throw new Error(`Loading rows failed: ${rows.error.message}`);

  return {
    project: { ...project, tax_rate: toNumber(project.tax_rate) ?? 0 },
    columns: columns.data ?? [],
    rows: (rows.data ?? []).map(toRowData),
  };
}
