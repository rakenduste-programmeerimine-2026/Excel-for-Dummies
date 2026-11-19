import type { CalcType } from '@/lib/calc';

/** Everything the export needs, already loaded by the caller. */
export type ExportData = {
  businessName: string | null;
  project: {
    name: string;
    client: string | null;
    address: string | null;
    tax_rate: number;
  };
  /** The user's extra columns, sorted by position. */
  columns: { id: string; name: string }[];
  /** Rows sorted by position. */
  rows: {
    date: string | null; // yyyy-mm-dd
    description: string;
    calc_type: CalcType;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    percent: number | null;
    extra: Record<string, string>;
  }[];
  exportDate: Date;
};
