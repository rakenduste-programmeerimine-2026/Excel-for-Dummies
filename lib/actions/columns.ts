import 'server-only';
import type { Supabase } from '@/lib/queries';
import { validation as t } from '@/lib/strings.et';
import { columnNameSchema, idSchema } from '@/lib/validation';
import { currentUserId } from './projects';
import { fail, fromZodError, notSignedIn, ok, saveFailed, type ActionResult } from './result';

// The user's own extra text columns ("Lisa veerg"). They never take part in calculations.

export type ColumnData = { id: string; project_id: string; name: string; position: number };

/** Adds a text column at the right end. `id` lets the editor create the id itself. */
export async function addColumn(supabase: Supabase, projectId: string, input: { name: string; id?: string }): Promise<ActionResult<ColumnData>> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(projectId).success) return fail(t.projectNotFound);
  if (input.id !== undefined && !idSchema.safeParse(input.id).success) return fail(t.invalidId);
  const name = columnNameSchema.safeParse(input.name);
  if (!name.success) return fromZodError(name.error);

  try {
    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return fail(t.projectNotFound);

    const { data: last, error: lastError } = await supabase
      .from('project_columns')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;

    const { data, error } = await supabase
      .from('project_columns')
      .insert({ ...(input.id ? { id: input.id } : {}), project_id: projectId, name: name.data, position: (last?.position ?? 0) + 1 })
      .select('id, project_id, name, position')
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return saveFailed('addColumn', error);
  }
}

/** Renames a column. Values in rows.extra are keyed by the column id, so they stay as they are. */
export async function renameColumn(supabase: Supabase, columnId: string, newName: string): Promise<ActionResult> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(columnId).success) return fail(t.columnNotFound);
  const name = columnNameSchema.safeParse(newName);
  if (!name.success) return fromZodError(name.error);

  const { data, error } = await supabase.from('project_columns').update({ name: name.data }).eq('id', columnId).select('id');
  if (error) return saveFailed('renameColumn', error);
  if (!data?.length) return fail(t.columnNotFound);
  return ok(null);
}

/** Deletes a column and its values in every row, in one transaction (delete_column RPC). */
export async function deleteColumn(supabase: Supabase, columnId: string): Promise<ActionResult> {
  if (!(await currentUserId(supabase))) return notSignedIn();
  if (!idSchema.safeParse(columnId).success) return fail(t.columnNotFound);

  try {
    // The RPC returns nothing either way, so check first that the user can see the column.
    const { data: column, error: loadError } = await supabase.from('project_columns').select('id').eq('id', columnId).maybeSingle();
    if (loadError) throw loadError;
    if (!column) return fail(t.columnNotFound);

    const { error } = await supabase.rpc('delete_column', { p_column_id: columnId });
    // P0002 (no_data_found): the column was deleted in the meantime, e.g. in another tab.
    if (error?.code === 'P0002') return fail(t.columnNotFound);
    if (error) throw error;
    return ok(null);
  } catch (error) {
    return saveFailed('deleteColumn', error);
  }
}
