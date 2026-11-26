'use server';

import * as rows from '@/lib/actions/rows';
import type { ActionResult } from '@/lib/actions/result';
import { createClient } from '@/lib/supabase/server';
import type { RowPatchInput } from '@/lib/validation';

// Server actions for the table editor. The editor keeps its own state, so these
// don't revalidate the page (that would reset the editor after every autosave);
// the page loads fresh data on the next visit because it is rendered per request.

export async function addRow(projectId: string, input: { id?: string } = {}): Promise<ActionResult<rows.RowData>> {
  return rows.addRow(await createClient(), projectId, input);
}

export async function updateRow(rowId: string, patch: RowPatchInput): Promise<ActionResult<rows.RowData>> {
  return rows.updateRow(await createClient(), rowId, patch);
}

export async function duplicateRow(rowId: string, input: { id?: string } = {}): Promise<ActionResult<rows.RowData>> {
  return rows.duplicateRow(await createClient(), rowId, input);
}

export async function deleteRow(rowId: string): Promise<ActionResult<{ project_id: string }>> {
  return rows.deleteRow(await createClient(), rowId);
}

export async function reorderRows(projectId: string, rowIds: string[]): Promise<ActionResult> {
  return rows.reorderRows(await createClient(), projectId, rowIds);
}
