import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildWorksheet, excelDate, formatDate, sheetName } from '@/lib/excel/buildWorkbook';
import { colLetter } from '@/lib/excel/colLetter';
import { sheetLayout } from '@/lib/excel/layout';
import { fixedRow, mockupProject, pctRow, qtyRow } from './fixtures';

const sheetFor = (data = mockupProject()) => buildWorksheet(new ExcelJS.Workbook(), data);
const rowValues = (sheet: ExcelJS.Worksheet, r: number) => (sheet.getRow(r).values as unknown[]).slice(1);

describe('colLetter', () => {
  it.each([
    [1, 'A'], [7, 'G'], [26, 'Z'], [27, 'AA'], [52, 'AZ'], [53, 'BA'], [702, 'ZZ'], [703, 'AAA'], [16_384, 'XFD'],
  ])('%i -> %s', (index, letters) => expect(colLetter(index)).toBe(letters));

  it.each([0, -1, 1.5, 16_385, Number.NaN])('rejects %s', (index) => expect(() => colLetter(index)).toThrow(RangeError));
});

describe('sheetLayout: letters move with the number of extra columns', () => {
  it.each([
    [0, { quantity: 'D', unitPrice: 'F', total: 'G' }],
    [1, { quantity: 'E', unitPrice: 'G', total: 'H' }],
    [3, { quantity: 'G', unitPrice: 'I', total: 'J' }],
    [25, { quantity: 'AC', unitPrice: 'AE', total: 'AF' }],
  ])('%i extra columns', (extras, letters) => expect(sheetLayout(extras, 3).letter).toEqual(letters));

  it('puts the totals block one empty row below the table', () => {
    expect(sheetLayout(1, 5).totalsRow).toEqual({ subtotal: 11, taxRate: 12, tax: 13, total: 14 });
    expect(sheetLayout(1, 0).totalsRow).toEqual({ subtotal: 6, taxRate: 7, tax: 8, total: 9 });
  });
});

describe('buildWorksheet layout (Estonian)', () => {
  it('row 1 is the business name and row 2 the project info with the export date', () => {
    const sheet = sheetFor();
    expect(sheet.getCell('A1').value).toBe('Priks Sisustus OÜ');
    expect(sheet.getCell('A2').value).toBe('Köögi remont · Mari Maasikas · Õie tänav 5, Tallinn · 19.11.2026');
  });

  it('skips empty project info parts', () => {
    const data = mockupProject();
    const sheet = sheetFor({ ...data, businessName: null, project: { ...data.project, client: null, address: '  ' } });
    expect(sheet.getCell('A1').value).toBe('');
    expect(sheet.getCell('A2').value).toBe('Köögi remont · 19.11.2026');
  });

  it('header: Nr | Kuupäev | Kirjeldus | extra columns | Kogus | Ühik | Ühiku hind | Summa', () => {
    const data = mockupProject({ columns: [{ id: 'a', name: 'Ruum' }, { id: 'b', name: 'Tarnija' }] });
    expect(rowValues(sheetFor(data), 4)).toEqual(['Nr', 'Kuupäev', 'Kirjeldus', 'Ruum', 'Tarnija', 'Kogus', 'Ühik', 'Ühiku hind', 'Summa']);
  });

  it('writes each row type with only the fields it uses', () => {
    const sheet = sheetFor(
      mockupProject({
        columns: [],
        rows: [
          qtyRow('Plaadid', 12.5, 'm²', 4.5, { date: '2026-03-11', percent: 99 }),
          fixedRow('Transport', 40, { quantity: 3, unit: 'tk' }),
          pctRow('Allahindlus', -12.5, { unit_price: 10 }),
        ],
      }),
    );
    expect(rowValues(sheet, 5).slice(0, 6)).toEqual([1, excelDate('2026-03-11'), 'Plaadid', 12.5, 'm²', 4.5]);
    expect(rowValues(sheet, 6).slice(0, 6)).toEqual([2, undefined, 'Transport', undefined, undefined, 40]);
    expect(rowValues(sheet, 7).slice(0, 5)).toEqual([3, undefined, 'Allahindlus', -0.125, 'ülalolevatest']);
    expect(sheet.getCell('F7').value).toBeNull(); // no unit price on a percent row
  });

  it('fills extra column text from rows.extra by column id', () => {
    const sheet = sheetFor();
    expect(sheet.getCell('D5').value).toBe('Köök');
    expect(sheet.getCell('D6').value).toBeNull();
  });

  it('labels the totals block left of the Summa column', () => {
    const sheet = sheetFor();
    expect([11, 12, 13, 14].map((r) => sheet.getCell(`G${r}`).value)).toEqual([
      'Vahesumma', 'Käibemaksumäär', 'Käibemaks', 'Kokku koos käibemaksuga',
    ]);
  });

  it('exports a project with zero rows', () => {
    const sheet = sheetFor(mockupProject({ rows: [] }));
    expect(sheet.getCell('C5').value).toBeNull();
    expect(sheet.getCell('G6').value).toBe('Vahesumma');
  });
});

describe('helpers', () => {
  it('sheetName removes \\ / ? * [ ] : and keeps 31 characters', () => {
    expect(sheetName('Köök / vannituba: [etapp 1]?')).toBe('Köök  vannituba etapp 1');
    expect(sheetName('x'.repeat(40))).toHaveLength(31);
    expect(sheetName(' *:? ')).toBe('Projekt');
    expect(sheetName('Õie tänav 5')).toBe('Õie tänav 5');
  });

  it('excelDate keeps the calendar day and rejects other formats', () => {
    expect(excelDate('2026-03-11').toISOString()).toBe('2026-03-11T00:00:00.000Z');
    expect(() => excelDate('11.03.2026')).toThrow('yyyy-mm-dd');
  });

  it('formatDate is dd.mm.yyyy in Tallinn time', () => {
    expect(formatDate(new Date('2026-11-19T23:30:00Z'))).toBe('20.11.2026');
    expect(formatDate(new Date('2026-03-05T08:00:00Z'))).toBe('05.03.2026');
  });
});
