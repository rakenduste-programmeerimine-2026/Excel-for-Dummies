import type { RowData } from '@/lib/actions/rows';
import type { RowInput } from '@/lib/calc';
import { parseDecimal } from '@/lib/format';
import { DECIMALS, type EditorRow } from './types';

// Each action except 'fillEmpty' maps 1:1 to a server action (see autosave.ts).
export type RowsAction =
  | { type: 'add'; id: string }
  | { type: 'update'; id: string; patch: Partial<Omit<EditorRow, 'id'>> }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'delete'; id: string }
  | { type: 'move'; id: string; direction: -1 | 1 }
  // Values the server filled in (calc-type defaults); only fields that are still empty take them.
  | { type: 'fillEmpty'; id: string; values: Pick<EditorRow, 'quantity' | 'unit_price' | 'percent'> };

export function emptyRow(id: string): EditorRow {
  return {
    id,
    description: '',
    calc_type: 'fixed',
    quantity: '',
    unit: '',
    unit_price: '',
    percent: '',
    extra: {},
  };
}

export function rowsReducer(rows: EditorRow[], action: RowsAction): EditorRow[] {
  switch (action.type) {
    case 'add':
      return [...rows, emptyRow(action.id)];
    case 'update':
      return rows.map((row) => (row.id === action.id ? { ...row, ...action.patch } : row));
    case 'duplicate': {
      const index = rows.findIndex((row) => row.id === action.id);
      if (index === -1) return rows;
      const copy = { ...rows[index]!, id: action.newId, extra: { ...rows[index]!.extra } };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    }
    case 'delete':
      return rows.filter((row) => row.id !== action.id);
    case 'move': {
      const from = rows.findIndex((row) => row.id === action.id);
      const to = from + action.direction;
      if (from === -1 || to < 0 || to >= rows.length) return rows;
      const next = [...rows];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    }
    case 'fillEmpty':
      return rows.map((row) => {
        if (row.id !== action.id) return row;
        const filled = { ...row };
        for (const field of ['quantity', 'unit_price', 'percent'] as const) {
          if (filled[field] === '') filled[field] = action.values[field];
        }
        return filled;
      });
  }
}

/** Number for calcProject: empty or invalid input counts as null (0); the field shows its own error. */
function toNumber(text: string, decimals: number): number | null {
  const value = parseDecimal(text, decimals);
  return value === 'invalid' ? null : value;
}

export function toRowInput(row: EditorRow): RowInput {
  return {
    calc_type: row.calc_type,
    quantity: toNumber(row.quantity, DECIMALS.quantity),
    unit_price: toNumber(row.unit_price, DECIMALS.unit_price),
    percent: toNumber(row.percent, DECIMALS.percent),
  };
}

/** Number as the user would type it, Estonian style: 4.5 → "4,50" for money, 2.5 → "2,5" otherwise. */
function toText(value: number | null, fixedDecimals?: number): string {
  if (value === null) return '';
  return (fixedDecimals === undefined ? String(value) : value.toFixed(fixedDecimals)).replace('.', ',');
}

/** A row from the database (via the row actions) as the editor holds it. */
export function toEditorRow(row: RowData): EditorRow {
  return {
    id: row.id,
    description: row.description,
    calc_type: row.calc_type,
    quantity: toText(row.quantity),
    unit: row.unit ?? '',
    unit_price: toText(row.unit_price, DECIMALS.unit_price),
    percent: toText(row.percent),
    extra: row.extra,
  };
}
