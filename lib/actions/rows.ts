import 'server-only';
import type { CalcType } from '@/lib/calc';
import { toExtra, toNumber, type Supabase } from '@/lib/queries';
import { validation as t } from '@/lib/strings.et';
import type { Database } from '@/lib/types.db';
import {
  calcTypeDefaults,
  definedOnly,
  idSchema,
  requiredFieldErrors,
  rowOrderSchema,
  rowPatchSchema,
  type RowPatchInput,
} from '@/lib/validation';
import { currentUserId } from './projects';
import { fail, fromZodError, notSignedIn, ok, saveFailed, type ActionResult } from './result';

// Logic of the row server actions (app/projects/[id]/actions.ts wraps them).
// Every query runs as the user, so RLS stops anyone from touching another user's rows.

type DbRow = Database['public']['Tables']['rows']['Row'];

/** A row as the actions return it: numeric columns as numbers. */
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

export function toRowData(row: DbRow): RowData {
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

const ROW_COLUMNS = 'id, project_id, position, date, description, calc_type, quantity, unit, unit_price, percent, extra, created_at';

async function loadRow(supabase: Supabase, rowId: string) {
  return supabase.from('rows').select(ROW_COLUMNS).eq('id', rowId).maybeSingle();
}

async function nextPosition(supabase: Supabase, projectId: string): Promise<number> {
  const { data, error } = await supabase.from('rows').select('position').eq('project_id', projectId).order('position', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data?.position ?? 0) + 1;
}

async function orderedRowIds(supabase: Supabase, projectId: string): Promise<string[]> {
  const { data, error } = await supabase.from('rows').select('id').eq('project_id', projectId).order('position').order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

/** Appends an empty "Kindel summa" row. `id` lets the editor create the row id itself (optimistic UI). */
export async function addRow(supabase: Supabase, projectId: string, input: { id?: string } = {}): Promise<ActionResult<RowData>> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(projectId).success) return fail(t.projectNotFound);
  if (input.id !== undefined && !idSchema.safeParse(input.id).success) return fail(t.invalidId);

  try {
    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return fail(t.projectNotFound);

    const { data, error } = await supabase
      .from('rows')
      .insert({
        ...(input.id ? { id: input.id } : {}),
        project_id: projectId,
        position: await nextPosition(supabase, projectId),
        description: '',
        calc_type: 'fixed',
        unit_price: 0,
        extra: {},
      })
      .select(ROW_COLUMNS)
      .single();
    if (error) throw error;
    return ok(toRowData(data));
  } catch (error) {
    return saveFailed('addRow', error);
  }
}

/**
 * Saves the fields the user changed (debounced autosave). The patch is merged with the stored
 * row and checked as a whole, with the same per-calc-type rules as the database.
 */
export async function updateRow(supabase: Supabase, rowId: string, patch: RowPatchInput): Promise<ActionResult<RowData>> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(rowId).success) return fail(t.rowNotFound);
  const parsed = rowPatchSchema.safeParse(patch);
  if (!parsed.success) return fromZodError(parsed.error);
  const changes = definedOnly(parsed.data);

  try {
    const { data: current, error: loadError } = await loadRow(supabase, rowId);
    if (loadError) throw loadError;
    if (!current) return fail(t.rowNotFound);
    if (Object.keys(changes).length === 0) return ok(toRowData(current));

    const stored = toRowData(current);
    const merged = { ...stored, ...changes };
    const defaults = changes.calc_type && changes.calc_type !== stored.calc_type ? calcTypeDefaults(merged) : {};
    const errors = requiredFieldErrors({ ...merged, ...defaults });
    const firstError = Object.values(errors)[0];
    if (firstError) return fail(firstError, errors);

    const { data, error } = await supabase
      .from('rows')
      .update({ ...changes, ...defaults })
      .eq('id', rowId)
      .select(ROW_COLUMNS)
      .single();
    if (error) throw error;
    return ok(toRowData(data));
  } catch (error) {
    return saveFailed('updateRow', error);
  }
}

/** Copies a row ("Tee koopia") and places the copy directly below the original. */
export async function duplicateRow(supabase: Supabase, rowId: string, input: { id?: string } = {}): Promise<ActionResult<RowData>> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(rowId).success) return fail(t.rowNotFound);
  if (input.id !== undefined && !idSchema.safeParse(input.id).success) return fail(t.invalidId);

  try {
    const { data: original, error: loadError } = await loadRow(supabase, rowId);
    if (loadError) throw loadError;
    if (!original) return fail(t.rowNotFound);

    const { data: copy, error: insertError } = await supabase
      .from('rows')
      .insert({
        ...(input.id ? { id: input.id } : {}),
        project_id: original.project_id,
        position: await nextPosition(supabase, original.project_id),
        date: original.date,
        description: original.description,
        calc_type: original.calc_type,
        quantity: original.quantity,
        unit: original.unit,
        unit_price: original.unit_price,
        percent: original.percent,
        extra: original.extra,
      })
      .select(ROW_COLUMNS)
      .single();
    if (insertError) throw insertError;

    // The copy was inserted at the end; move it right below the original.
    const ids = (await orderedRowIds(supabase, original.project_id)).filter((id) => id !== copy.id);
    ids.splice(ids.indexOf(original.id) + 1, 0, copy.id);
    const { error: reorderError } = await supabase.rpc('reorder_rows', { p_project_id: original.project_id, p_row_ids: ids });
    if (reorderError) {
      await supabase.from('rows').delete().eq('id', copy.id); // don't leave a stray copy at the end
      throw reorderError;
    }
    return ok({ ...toRowData(copy), position: ids.indexOf(copy.id) + 1 });
  } catch (error) {
    return saveFailed('duplicateRow', error);
  }
}

export async function deleteRow(supabase: Supabase, rowId: string): Promise<ActionResult<{ project_id: string }>> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(rowId).success) return fail(t.rowNotFound);

  const { data, error } = await supabase.from('rows').delete().eq('id', rowId).select('project_id');
  if (error) return saveFailed('deleteRow', error);
  const deleted = data?.[0];
  if (!deleted) return fail(t.rowNotFound);
  return ok({ project_id: deleted.project_id });
}

/**
 * Saves a new row order. `rowIds` is the full order (all rows of the project), as the editor
 * shows it after "Liiguta üles/alla". The database RPC rewrites positions in one transaction.
 */
export async function reorderRows(supabase: Supabase, projectId: string, rowIds: string[]): Promise<ActionResult> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(projectId).success) return fail(t.projectNotFound);
  const parsed = rowOrderSchema.safeParse(rowIds);
  if (!parsed.success) return fail(t.invalidOrder);

  const { error } = await supabase.rpc('reorder_rows', { p_project_id: projectId, p_row_ids: parsed.data });
  if (error) {
    // 22023 (invalid_parameter_value) = raised by reorder_rows when the ids aren't exactly the
    // project's rows, e.g. a row was added or deleted in another tab. See supabase/migrations/*_functions.sql.
    if (error.code === '22023') return fail(t.invalidOrder);
    return saveFailed('reorderRows', error);
  }
  return ok(null);
}
