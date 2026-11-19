import { colLetter } from './colLetter';

export const HEADER_ROW = 4;
export const FIRST_DATA_ROW = HEADER_ROW + 1;

export type SheetLayout = ReturnType<typeof sheetLayout>;

/**
 * Columns: Nr | Kuupäev | Kirjeldus | [extra columns…] | Kogus | Ühik | Ühiku hind | Summa
 * Everything after Kirjeldus shifts with the number of extra columns.
 */
export function sheetLayout(extraColumnCount: number, rowCount: number) {
  const no = 1;
  const date = 2;
  const description = 3;
  const firstExtra = 4;
  const quantity = firstExtra + extraColumnCount;
  const unit = quantity + 1;
  const unitPrice = unit + 1;
  const total = unitPrice + 1;
  const lastDataRow = FIRST_DATA_ROW + rowCount - 1; // < FIRST_DATA_ROW when there are no rows
  const totalsStart = Math.max(lastDataRow, HEADER_ROW) + 2; // one empty row below the table
  return {
    col: { no, date, description, firstExtra, quantity, unit, unitPrice, total },
    letter: { quantity: colLetter(quantity), unitPrice: colLetter(unitPrice), total: colLetter(total) },
    columnCount: total,
    firstDataRow: FIRST_DATA_ROW,
    lastDataRow,
    totalsRow: { subtotal: totalsStart, taxRate: totalsStart + 1, tax: totalsStart + 2, total: totalsStart + 3 },
  };
}
