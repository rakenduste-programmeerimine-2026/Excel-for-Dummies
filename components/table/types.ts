import type { CalcType } from '@/lib/calc';

/** A row as the editor holds it: the DB row shape, with number fields kept as the text the user typed. */
export type EditorRow = {
  id: string;
  description: string;
  calc_type: CalcType;
  quantity: string;
  unit: string;
  unit_price: string;
  percent: string;
  extra: Record<string, string>;
};

/** Decimals allowed per number field (numeric(12,3), numeric(12,2), numeric(6,2)). */
export const DECIMALS = { quantity: 3, unit_price: 2, percent: 2 } as const;
