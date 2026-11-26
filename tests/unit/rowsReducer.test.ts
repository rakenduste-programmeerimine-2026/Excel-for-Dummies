import { describe, expect, it } from 'vitest';
import { calcRows } from '@/lib/calc';
import { emptyRow, rowsReducer, toEditorRow, toRowInput } from '@/components/table/rowsReducer';
import type { RowData } from '@/lib/actions/rows';
import type { EditorRow } from '@/components/table/types';

const row = (id: string, patch: Partial<EditorRow> = {}): EditorRow => ({ ...emptyRow(id), ...patch });
const ids = (rows: EditorRow[]) => rows.map((r) => r.id);

describe('rowsReducer', () => {
  const rows = [row('a'), row('b'), row('c')];

  it('adds an empty fixed row at the end', () => {
    const next = rowsReducer(rows, { type: 'add', id: 'd' });
    expect(ids(next)).toEqual(['a', 'b', 'c', 'd']);
    expect(next[3]).toEqual(emptyRow('d'));
  });

  it('updates only the given row', () => {
    const next = rowsReducer(rows, { type: 'update', id: 'b', patch: { description: 'Tööjõud' } });
    expect(next[1]!.description).toBe('Tööjõud');
    expect(next[0]).toBe(rows[0]);
  });

  it('puts a duplicate directly below the original, with its own extra object', () => {
    const withExtra = [row('a'), row('b', { description: 'Värv', extra: { col: 'Köök' } }), row('c')];
    const next = rowsReducer(withExtra, { type: 'duplicate', id: 'b', newId: 'b2' });
    expect(ids(next)).toEqual(['a', 'b', 'b2', 'c']);
    expect(next[2]).toEqual({ ...withExtra[1], id: 'b2' });
    expect(next[2]!.extra).not.toBe(withExtra[1]!.extra);
  });

  it('deletes a row', () => {
    expect(ids(rowsReducer(rows, { type: 'delete', id: 'b' }))).toEqual(['a', 'c']);
  });

  it('moves rows up and down, and does nothing at the edges', () => {
    expect(ids(rowsReducer(rows, { type: 'move', id: 'b', direction: -1 }))).toEqual(['b', 'a', 'c']);
    expect(ids(rowsReducer(rows, { type: 'move', id: 'b', direction: 1 }))).toEqual(['a', 'c', 'b']);
    expect(rowsReducer(rows, { type: 'move', id: 'a', direction: -1 })).toBe(rows);
    expect(rowsReducer(rows, { type: 'move', id: 'c', direction: 1 })).toBe(rows);
  });

  it('returns the same rows for an unknown id', () => {
    expect(rowsReducer(rows, { type: 'duplicate', id: 'x', newId: 'y' })).toBe(rows);
    expect(rowsReducer(rows, { type: 'move', id: 'x', direction: 1 })).toBe(rows);
  });
});

describe('toRowInput', () => {
  it('parses comma decimals for calcProject', () => {
    const input = toRowInput(row('a', { calc_type: 'qty_price', quantity: '10', unit_price: '4,50' }));
    expect(input).toEqual({ calc_type: 'qty_price', quantity: 10, unit_price: 4.5, percent: null });
  });

  it('treats invalid input as null so calcProject never throws', () => {
    const input = toRowInput(row('a', { unit_price: '12,555', quantity: 'abc' }));
    expect(input.unit_price).toBeNull();
    expect(input.quantity).toBeNull();
    expect(calcRows([input])).toEqual([0]);
  });

  it('moving a percent row changes its total', () => {
    const rows = [
      row('a', { unit_price: '100' }),
      row('p', { calc_type: 'percent', percent: '-10' }),
      row('b', { unit_price: '50' }),
    ];
    const totals = (r: EditorRow[]) => calcRows(r.map(toRowInput));
    expect(totals(rows)).toEqual([100, -10, 50]);
    expect(totals(rowsReducer(rows, { type: 'move', id: 'p', direction: 1 }))).toEqual([100, 50, -15]);
  });
});

describe('fillEmpty', () => {
  it('fills only the fields that are still empty', () => {
    const rows = [row('a', { calc_type: 'qty_price', unit_price: '5' })];
    const next = rowsReducer(rows, { type: 'fillEmpty', id: 'a', values: { quantity: '1', unit_price: '0,00', percent: '' } });
    expect(next[0]).toMatchObject({ quantity: '1', unit_price: '5', percent: '' });
  });
});

describe('toEditorRow', () => {
  const base: RowData = {
    id: 'a',
    project_id: 'p',
    position: 1,
    date: null,
    description: 'Krohv',
    calc_type: 'qty_price',
    quantity: 2.5,
    unit: 'm²',
    unit_price: 4.5,
    percent: null,
    extra: { col: 'Köök' },
  };

  it('shows numbers the Estonian way, money with 2 decimals', () => {
    expect(toEditorRow(base)).toEqual({
      id: 'a',
      description: 'Krohv',
      calc_type: 'qty_price',
      quantity: '2,5',
      unit: 'm²',
      unit_price: '4,50',
      percent: '',
      extra: { col: 'Köök' },
    });
  });

  it('turns nulls into empty fields and keeps negative percents', () => {
    const editor = toEditorRow({ ...base, calc_type: 'percent', quantity: null, unit: null, unit_price: null, percent: -10 });
    expect(editor).toMatchObject({ quantity: '', unit: '', unit_price: '', percent: '-10' });
  });

  it('round-trips through toRowInput', () => {
    expect(toRowInput(toEditorRow(base))).toEqual({ calc_type: 'qty_price', quantity: 2.5, unit_price: 4.5, percent: null });
  });
});
