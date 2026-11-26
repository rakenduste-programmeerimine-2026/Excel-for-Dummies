import type { ActionResult } from '@/lib/actions/result';
import type { RowData } from '@/lib/actions/rows';
import { parseDecimal } from '@/lib/format';
import { validation } from '@/lib/strings.et';
import type { RowPatchInput } from '@/lib/validation';
import { DECIMALS, type EditorRow } from './types';

/** The row server actions (app/projects/[id]/actions.ts); passed in so tests can fake them. */
export type RowActions = {
  addRow: (projectId: string, input: { id: string }) => Promise<ActionResult<RowData>>;
  updateRow: (rowId: string, patch: RowPatchInput) => Promise<ActionResult<RowData>>;
  duplicateRow: (rowId: string, input: { id: string }) => Promise<ActionResult<RowData>>;
  deleteRow: (rowId: string) => Promise<ActionResult<unknown>>;
  reorderRows: (projectId: string, rowIds: string[]) => Promise<ActionResult<unknown>>;
};

export type SaveStatus = { state: 'idle' } | { state: 'saving' } | { state: 'saved' } | { state: 'error'; message: string };

type Patch = Partial<Omit<EditorRow, 'id'>>;

/**
 * What to send for an edit. Numbers go as typed ("12,50"): the server parses them with the same
 * parser. A number the user left invalid isn't sent; its field shows the error until it's fixed.
 */
export function toRowPatch(patch: Patch): RowPatchInput {
  const out: RowPatchInput = {};
  if (patch.description !== undefined) out.description = patch.description;
  if (patch.calc_type !== undefined) out.calc_type = patch.calc_type;
  if (patch.unit !== undefined) out.unit = patch.unit;
  for (const field of ['quantity', 'unit_price', 'percent'] as const) {
    const value = patch[field];
    if (value !== undefined && parseDecimal(value, DECIMALS[field]) !== 'invalid') out[field] = value;
  }
  return out;
}

/**
 * Saves the editor's changes in the background. Edits are debounced per row; everything else
 * saves right away. Saves run one at a time, in order, so a row is always created before its
 * edits arrive and two moves can't race. A failed edit is kept and sent again with the row's next edit.
 */
export class Autosaver {
  private queue: Promise<void> = Promise.resolve();
  private pending = new Map<string, { patch: Patch; timer?: ReturnType<typeof setTimeout> }>();
  private running = 0;
  private error: string | null = null;

  constructor(
    private projectId: string,
    private actions: RowActions,
    private onStatus: (status: SaveStatus) => void,
    private onCalcTypeSaved: (row: RowData) => void,
    private delayMs = 600,
  ) {}

  add(id: string) {
    this.run(() => this.actions.addRow(this.projectId, { id }));
  }

  update(id: string, patch: Patch) {
    const existing = this.pending.get(id);
    if (existing?.timer) clearTimeout(existing.timer);
    this.pending.set(id, { patch: { ...existing?.patch, ...patch }, timer: setTimeout(() => this.flushRow(id), this.delayMs) });
    this.report();
  }

  duplicate(id: string, newId: string) {
    this.flushRow(id); // the server copies the stored row, so save its latest edits first
    this.run(() => this.actions.duplicateRow(id, { id: newId }));
  }

  delete(id: string) {
    clearTimeout(this.pending.get(id)?.timer);
    this.pending.delete(id);
    this.run(() => this.actions.deleteRow(id));
  }

  reorder(rowIds: string[]) {
    this.run(() => this.actions.reorderRows(this.projectId, rowIds));
  }

  /** Sends every waiting edit now (leaving the page). */
  flushAll() {
    for (const id of [...this.pending.keys()]) this.flushRow(id);
  }

  hasUnsaved(): boolean {
    return this.running > 0 || this.pending.size > 0;
  }

  private flushRow(id: string) {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    const body = toRowPatch(entry.patch);
    if (Object.keys(body).length === 0) return this.report();

    this.run(async () => {
      const result = await this.actions.updateRow(id, body);
      if (result.ok) {
        if (body.calc_type) this.onCalcTypeSaved(result.data);
      } else {
        // Keep it for the next try; newer edits of the same fields win.
        const newer = this.pending.get(id);
        this.pending.set(id, { ...newer, patch: { ...entry.patch, ...newer?.patch } });
      }
      return result;
    });
  }

  private run(save: () => Promise<ActionResult<unknown>>) {
    this.running++;
    this.report();
    this.queue = this.queue.then(async () => {
      try {
        const result = await save();
        this.error = result.ok ? null : result.error;
      } catch {
        this.error = validation.saveFailed; // network error or the server action threw
      } finally {
        this.running--;
        this.report();
      }
    });
  }

  private report() {
    const waiting = this.running > 0 || [...this.pending.values()].some((p) => p.timer !== undefined);
    if (waiting) this.onStatus({ state: 'saving' });
    else if (this.error) this.onStatus({ state: 'error', message: this.error });
    else this.onStatus({ state: 'saved' });
  }
}
