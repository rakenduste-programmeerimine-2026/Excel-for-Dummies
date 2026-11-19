import 'server-only';
import ExcelJS from 'exceljs';
import { xlsx } from '@/lib/strings.et';
import { HEADER_ROW, sheetLayout } from './layout';
import type { ExportData } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** yyyy-mm-dd -> a Date at UTC midnight, which Excel shows as that calendar day. */
export function excelDate(isoDate: string): Date {
  const m = ISO_DATE.exec(isoDate);
  if (!m) throw new RangeError(`Expected a yyyy-mm-dd date, got "${isoDate}"`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** dd.mm.yyyy in Tallinn time, for text. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

/** Excel sheet names: none of \ / ? * [ ] : and at most 31 characters. */
export function sheetName(projectName: string): string {
  const cleaned = projectName.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31).trim();
  return cleaned || xlsx.defaultSheetName;
}

/** Builds the worksheet. Exposed separately so tests can inspect the cells. */
export function buildWorksheet(workbook: ExcelJS.Workbook, data: ExportData): ExcelJS.Worksheet {
  const layout = sheetLayout(data.columns.length, data.rows.length);
  const { col } = layout;
  const sheet = workbook.addWorksheet(sheetName(data.project.name));

  // Row 1: business name. Row 2: project, client, address, export date.
  sheet.getCell(1, 1).value = data.businessName ?? '';
  sheet.getCell(2, 1).value = [data.project.name, data.project.client, data.project.address, formatDate(data.exportDate)]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' · ');

  const h = xlsx.headers;
  const headers = [h.no, h.date, h.description, ...data.columns.map((c) => c.name), h.quantity, h.unit, h.unitPrice, h.total];
  headers.forEach((text, i) => (sheet.getCell(HEADER_ROW, i + 1).value = text));

  data.rows.forEach((row, i) => {
    const r = layout.firstDataRow + i;
    sheet.getCell(r, col.no).value = i + 1;
    if (row.date) sheet.getCell(r, col.date).value = excelDate(row.date);
    sheet.getCell(r, col.description).value = row.description;
    data.columns.forEach((c, j) => {
      const text = row.extra[c.id];
      if (text) sheet.getCell(r, col.firstExtra + j).value = text;
    });
    // Only the fields this row's type uses are written, even if the database still holds others.
    if (row.calc_type === 'qty_price') {
      sheet.getCell(r, col.quantity).value = row.quantity ?? 0;
      if (row.unit) sheet.getCell(r, col.unit).value = row.unit;
      sheet.getCell(r, col.unitPrice).value = row.unit_price ?? 0;
    } else if (row.calc_type === 'fixed') {
      sheet.getCell(r, col.unitPrice).value = row.unit_price ?? 0;
    } else {
      sheet.getCell(r, col.quantity).value = (row.percent ?? 0) / 100;
      sheet.getCell(r, col.unit).value = xlsx.percentUnit;
    }
  });

  const t = xlsx.totals;
  const labels: [number, string][] = [
    [layout.totalsRow.subtotal, t.subtotal],
    [layout.totalsRow.taxRate, t.taxRate],
    [layout.totalsRow.tax, t.tax],
    [layout.totalsRow.total, t.total],
  ];
  for (const [r, text] of labels) sheet.getCell(r, col.unitPrice).value = text;

  return sheet;
}

export async function buildWorkbook(data: ExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = data.exportDate;
  buildWorksheet(workbook, data);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
