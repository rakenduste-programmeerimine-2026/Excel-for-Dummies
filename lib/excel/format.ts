import type ExcelJS from 'exceljs';
import { HEADER_ROW, type SheetLayout } from './layout';

/** Estonian style: sign after the amount; negatives (discounts) in red. */
export const MONEY_FORMAT = '#,##0.00 "€";[Red]-#,##0.00 "€"';
/** Two decimals so 12.5 % is not shown as 13 %. */
export const PERCENT_FORMAT = '0.00%';
export const DATE_FORMAT = 'dd.mm.yyyy';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF8EA9DB' } };
const BOX: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** exceljs replaces the whole font when one is set, so every styled cell gets the same face. */
const FONT = { name: 'Calibri', size: 11 } as const;

const MIN_WIDTH = 6;
const MAX_WIDTH = 50;

/** Roughly how many characters a cell shows, used for auto-sizing columns. */
function displayLength(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v === null || v === undefined) return 0;
  if (v instanceof Date) return 10; // dd.mm.yyyy
  const n = typeof v === 'number' ? v : typeof v === 'object' && 'formula' in v ? cell.result : undefined;
  if (typeof n === 'number') {
    if (cell.numFmt === PERCENT_FORMAT) return (n * 100).toFixed(2).length + 1;
    if (cell.numFmt === MONEY_FORMAT) return Math.abs(n).toLocaleString('et-EE', { minimumFractionDigits: 2 }).length + 3;
    return String(n).length;
  }
  return String(v).length;
}

export function formatSheet(sheet: ExcelJS.Worksheet, layout: SheetLayout): void {
  const { col, firstDataRow, lastDataRow, totalsRow, columnCount } = layout;

  // Rows 1-2: business name and project info
  sheet.getCell(1, 1).font = { ...FONT, bold: true, size: 16 };
  sheet.getCell(2, 1).font = { ...FONT, color: { argb: 'FF595959' } };

  // Header row: bold, filled, bordered, frozen
  for (let c = 1; c <= columnCount; c++) {
    const cell = sheet.getCell(HEADER_ROW, c);
    cell.font = { ...FONT, bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BOX;
    cell.alignment = { vertical: 'middle', horizontal: c >= col.quantity && c !== col.unit ? 'right' : 'left' };
  }
  sheet.getRow(HEADER_ROW).height = 20;
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: HEADER_ROW }];

  // Table body
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    for (let c = 1; c <= columnCount; c++) {
      sheet.getCell(r, c).border = BOX;
      sheet.getCell(r, c).font = FONT;
    }
    sheet.getCell(r, col.no).alignment = { horizontal: 'center' };
    sheet.getCell(r, col.date).numFmt = DATE_FORMAT;
    sheet.getCell(r, col.unitPrice).numFmt = MONEY_FORMAT;
    sheet.getCell(r, col.total).numFmt = MONEY_FORMAT;
    sheet.getCell(r, col.description).alignment = { wrapText: true, vertical: 'top' };
    const quantity = sheet.getCell(r, col.quantity);
    // A percent row stores its percent as a fraction in the quantity column.
    const isPercentRow = typeof quantity.value === 'number' && sheet.getCell(r, col.unitPrice).value === null;
    if (isPercentRow) quantity.numFmt = PERCENT_FORMAT;
  }

  // Totals block: bold. Labels are right-aligned so long ones spill into the empty cells on their left.
  for (const r of [totalsRow.subtotal, totalsRow.taxRate, totalsRow.tax, totalsRow.total]) {
    const label = sheet.getCell(r, col.unitPrice);
    label.font = { ...FONT, bold: true };
    label.alignment = { horizontal: 'right' };
    const value = sheet.getCell(r, col.total);
    value.font = { ...FONT, bold: true };
    value.numFmt = r === totalsRow.taxRate ? PERCENT_FORMAT : MONEY_FORMAT;
    value.border = BOX;
  }
  sheet.getCell(totalsRow.total, col.total).border = { ...BOX, top: { style: 'thin' }, bottom: { style: 'double' } };

  // Auto-sized column widths from the header and the table (not rows 1-2 or the totals labels).
  for (let c = 1; c <= columnCount; c++) {
    let longest = displayLength(sheet.getCell(HEADER_ROW, c));
    for (let r = firstDataRow; r <= lastDataRow; r++) longest = Math.max(longest, displayLength(sheet.getCell(r, c)));
    if (c === col.total) {
      for (const r of [totalsRow.subtotal, totalsRow.tax, totalsRow.total]) longest = Math.max(longest, displayLength(sheet.getCell(r, c)));
    }
    sheet.getColumn(c).width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.ceil(longest * 1.1) + 2));
  }

  // Printing: A4, fit all columns on one page width.
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}
