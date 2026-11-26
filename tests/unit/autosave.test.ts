import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosaver, toRowPatch, type RowActions, type SaveStatus } from '@/components/table/autosave';
import type { ActionResult } from '@/lib/actions/result';
import type { RowData } from '@/lib/actions/rows';
import { validation } from '@/lib/strings.et';

const rowData = (patch: Partial<RowData> = {}): RowData => ({
  id: 'a',
  project_id: 'p',
  position: 1,
  date: null,
  description: '',
  calc_type: 'fixed',
  quantity: null,
  unit: null,
  unit_price: 0,
  percent: null,
  extra: {},
  ...patch,
});

const okRow = (patch?: Partial<RowData>): ActionResult<RowData> => ({ ok: true, data: rowData(patch) });

function setup() {
  const calls: string[] = [];
  const log =
    <T,>(name: string, result: () => ActionResult<T>) =>
    async (...args: unknown[]) => {
      calls.push(`${name} ${JSON.stringify(args)}`);
      return result();
    };
  const actions = {
    addRow: vi.fn(log('add', () => okRow())),
    updateRow: vi.fn(log('update', () => okRow())),
    duplicateRow: vi.fn(log('duplicate', () => okRow())),
    deleteRow: vi.fn(log('delete', () => ({ ok: true, data: null }))),
    reorderRows: vi.fn(log('reorder', () => ({ ok: true, data: null }))),
  } satisfies RowActions;
  const statuses: SaveStatus[] = [];
  const filled: RowData[] = [];
  const saver = new Autosaver('p', actions, (s) => statuses.push(s), (row) => filled.push(row), 600);
  const settle = async () => {
    await vi.runAllTimersAsync();
  };
  return { saver, actions, calls, statuses, filled, settle, last: () => statuses.at(-1) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('toRowPatch', () => {
  it('sends text and numbers as typed', () => {
    expect(toRowPatch({ description: 'Värv', unit: 'm²', quantity: '12,5', unit_price: '' })).toEqual({
      description: 'Värv',
      unit: 'm²',
      quantity: '12,5',
      unit_price: '',
    });
  });

  it('leaves out numbers the user left invalid', () => {
    expect(toRowPatch({ description: 'X', quantity: '12,5,0', percent: '1,234' })).toEqual({ description: 'X' });
  });
});

describe('Autosaver', () => {
  it('merges quick edits of one row into one save after the pause', async () => {
    const { saver, actions, settle, last } = setup();
    saver.update('a', { description: 'V' });
    saver.update('a', { description: 'Värv' });
    saver.update('a', { unit_price: '4,50' });
    expect(last()).toEqual({ state: 'saving' });
    expect(actions.updateRow).not.toHaveBeenCalled();

    await settle();
    expect(actions.updateRow).toHaveBeenCalledTimes(1);
    expect(actions.updateRow).toHaveBeenCalledWith('a', { description: 'Värv', unit_price: '4,50' });
    expect(last()).toEqual({ state: 'saved' });
  });

  it('runs saves in order: a new row is created before its edits', async () => {
    const { saver, calls, settle } = setup();
    saver.add('n');
    saver.update('n', { description: 'Uus' });
    saver.reorder(['n', 'a']);
    await settle();
    expect(calls.map((c) => c.split(' ')[0])).toEqual(['add', 'reorder', 'update']);
  });

  it('saves a row’s waiting edits before duplicating it', async () => {
    const { saver, calls, settle } = setup();
    saver.update('a', { description: 'Värv' });
    saver.duplicate('a', 'b');
    await settle();
    expect(calls).toEqual(['update ["a",{"description":"Värv"}]', 'duplicate ["a",{"id":"b"}]']);
  });

  it('drops waiting edits of a deleted row', async () => {
    const { saver, actions, settle } = setup();
    saver.update('a', { description: 'Värv' });
    saver.delete('a');
    await settle();
    expect(actions.updateRow).not.toHaveBeenCalled();
    expect(actions.deleteRow).toHaveBeenCalledWith('a');
  });

  it('skips the request when only invalid numbers changed', async () => {
    const { saver, actions, settle, last } = setup();
    saver.update('a', { quantity: 'abc' });
    await settle();
    expect(actions.updateRow).not.toHaveBeenCalled();
    expect(last()).toEqual({ state: 'saved' });
  });

  it('shows the server error and resends the failed edit with the next one', async () => {
    const { saver, actions, settle, last } = setup();
    actions.updateRow.mockResolvedValueOnce({ ok: false, error: validation.unitPriceRequired });
    saver.update('a', { description: 'Värv', unit_price: '' });
    await settle();
    expect(last()).toEqual({ state: 'error', message: validation.unitPriceRequired });
    expect(saver.hasUnsaved()).toBe(true);

    saver.update('a', { unit_price: '5' });
    await settle();
    expect(actions.updateRow).toHaveBeenLastCalledWith('a', { description: 'Värv', unit_price: '5' });
    expect(last()).toEqual({ state: 'saved' });
    expect(saver.hasUnsaved()).toBe(false);
  });

  it('reports a network failure in Estonian', async () => {
    const { saver, actions, settle, last } = setup();
    actions.deleteRow.mockRejectedValueOnce(new Error('Failed to fetch'));
    saver.delete('a');
    await settle();
    expect(last()).toEqual({ state: 'error', message: validation.saveFailed });
  });

  it('hands back the saved row after a calc type change, for the server defaults', async () => {
    const { saver, actions, filled, settle } = setup();
    actions.updateRow.mockResolvedValueOnce(okRow({ calc_type: 'qty_price', quantity: 1, unit_price: 0 }));
    saver.update('a', { description: 'Värv' });
    await settle();
    expect(filled).toEqual([]);

    saver.update('a', { calc_type: 'qty_price' });
    await settle();
    expect(filled).toHaveLength(1);
  });

  it('flushAll sends waiting edits without waiting for the pause', async () => {
    const { saver, actions } = setup();
    saver.update('a', { description: 'Värv' });
    saver.flushAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(actions.updateRow).toHaveBeenCalledTimes(1);
  });
});
