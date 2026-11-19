import type { RowInput } from '@/lib/calc';
import { parseDecimal } from '@/lib/format';
import { DECIMALS, type EditorRow } from './types';

// Each action maps 1:1 to a server action once the backend exists (#10).
export type RowsAction =
  | { type: 'add'; id: string }
  | { type: 'update'; id: string; patch: Partial<Omit<EditorRow, 'id'>> }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'delete'; id: string }
  | { type: 'move'; id: string; direction: -1 | 1 };

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
