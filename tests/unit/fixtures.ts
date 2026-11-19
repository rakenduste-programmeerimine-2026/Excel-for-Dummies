import type { ExportData } from '@/lib/excel/types';

type Row = ExportData['rows'][number];
const base = { date: null, quantity: null, unit: null, unit_price: null, percent: null, extra: {} };

export const fixedRow = (description: string, unit_price: number, more: Partial<Row> = {}): Row => ({
  ...base, description, calc_type: 'fixed', unit_price, ...more,
});
export const qtyRow = (description: string, quantity: number, unit: string, unit_price: number, more: Partial<Row> = {}): Row => ({
  ...base, description, calc_type: 'qty_price', quantity, unit, unit_price, ...more,
});
export const pctRow = (description: string, percent: number, more: Partial<Row> = {}): Row => ({
  ...base, description, calc_type: 'percent', percent, ...more,
});

/** The project from the mockup in docs/backend/design.md section 3. */
export function mockupProject(overrides: Partial<ExportData> = {}): ExportData {
  return {
    businessName: 'Priks Sisustus OÜ',
    project: { name: 'Köögi remont', client: 'Mari Maasikas', address: 'Õie tänav 5, Tallinn', tax_rate: 24 },
    columns: [{ id: 'col-ruum', name: 'Ruum' }],
    rows: [
      qtyRow('Seinavärv', 10, 'l', 12.5, { date: '2026-11-02', extra: { 'col-ruum': 'Köök' } }),
      qtyRow('Tööjõud', 8, 'h', 25, { date: '2026-11-03' }),
      fixedRow('Transport', 40),
      pctRow('Juurdehindlus', 15),
      pctRow('Allahindlus', -10),
    ],
    exportDate: new Date('2026-11-19T10:00:00Z'),
    ...overrides,
  };
}
