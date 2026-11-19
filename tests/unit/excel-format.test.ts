import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildWorkbook, buildWorksheet } from '@/lib/excel/buildWorkbook';
import { DATE_FORMAT, MONEY_FORMAT, PERCENT_FORMAT } from '@/lib/excel/format';
import { fixedRow, mockupProject, pctRow } from './fixtures';

const sheetFor = (data = mockupProject()) => buildWorksheet(new ExcelJS.Workbook(), data);

describe('number formats', () => {
  const sheet = sheetFor();

  it('money is Estonian style with € after the amount and red negatives', () => {
    expect(MONEY_FORMAT).toBe('#,##0.00 "€";[Red]-#,##0.00 "€"');
    for (const a of ['G5', 'G7', 'H5', 'H9', 'H11', 'H13', 'H14']) expect(sheet.getCell(a).numFmt, a).toBe(MONEY_FORMAT);
  });

  it('percent cells (percent rows and the tax rate) show two decimals', () => {
    expect(PERCENT_FORMAT).toBe('0.00%');
    for (const a of ['E8', 'E9', 'H12']) expect(sheet.getCell(a).numFmt, a).toBe(PERCENT_FORMAT);
  });

  it('quantities of quantity × price rows are not formatted as percent', () => {
    expect(sheet.getCell('E5').numFmt).not.toBe(PERCENT_FORMAT);
  });

  it('dates are dd.mm.yyyy', () => {
    expect(sheet.getCell('B5').numFmt).toBe(DATE_FORMAT);
    expect(DATE_FORMAT).toBe('dd.mm.yyyy');
  });
});

describe('styling', () => {
  const sheet = sheetFor();

  it('business name is bold and larger', () => {
    expect(sheet.getCell('A1').font).toMatchObject({ bold: true, size: 16 });
  });

  it('uses one font face everywhere (bold cells keep it too)', () => {
    for (const a of ['A1', 'A2', 'A4', 'C5', 'H9', 'G14', 'H14']) expect(sheet.getCell(a).font?.name, a).toBe('Calibri');
  });

  it('header row is bold, filled and bordered across every column', () => {
    for (const c of ['A', 'D', 'H']) {
      const cell = sheet.getCell(`${c}4`);
      expect(cell.font?.bold, c).toBe(true);
      expect(cell.fill).toMatchObject({ type: 'pattern', pattern: 'solid' });
      expect(cell.border?.bottom?.style).toBe('thin');
    }
  });

  it('table cells have thin borders, including empty ones', () => {
    for (const a of ['A5', 'D6', 'F7', 'H9']) {
      expect(sheet.getCell(a).border, a).toMatchObject({ top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
    }
  });

  it('totals block is bold, labels right-aligned, grand total double-underlined', () => {
    for (const r of [11, 12, 13, 14]) {
      expect(sheet.getCell(`G${r}`).font?.bold).toBe(true);
      expect(sheet.getCell(`G${r}`).alignment?.horizontal).toBe('right');
      expect(sheet.getCell(`H${r}`).font?.bold).toBe(true);
    }
    expect(sheet.getCell('H14').border?.bottom?.style).toBe('double');
  });

  it('freezes the header (rows 1-4 stay visible)', () => {
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
  });

  it('prints on A4, fitting the page width', () => {
    expect(sheet.pageSetup).toMatchObject({ paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
  });
});

describe('auto-sized column widths', () => {
  it('fits the longest value and stays between 6 and 50', () => {
    const long = 'Seinte krohvimine ja värvimine kahes kihis';
    const sheet = sheetFor(mockupProject({ rows: [fixedRow(long, 1234567.89), pctRow('Allahindlus', -10)] }));
    expect(sheet.getColumn(3).width).toBe(Math.ceil(long.length * 1.1) + 2); // Kirjeldus
    expect(sheet.getColumn(1).width).toBe(6); // "Nr" -> minimum, not widened by the business name in A1
    expect(sheet.getColumn(8).width).toBeGreaterThanOrEqual('1 234 567,89 €'.length);
    const huge = sheetFor(mockupProject({ rows: [fixedRow('x'.repeat(200), 1)] }));
    expect(huge.getColumn(3).width).toBe(50);
  });

  it('works for a project with zero rows', () => {
    const sheet = sheetFor(mockupProject({ rows: [] }));
    expect(sheet.getColumn(8).width).toBeGreaterThanOrEqual(6);
  });
});

describe('the saved .xlsx file keeps the formatting', () => {
  it('round-trips formats, fonts and the frozen header', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(mockupProject())) as unknown as ArrayBuffer);
    const sheet = wb.worksheets[0]!;
    expect(sheet.getCell('H9').numFmt).toBe(MONEY_FORMAT);
    expect(sheet.getCell('E8').numFmt).toBe(PERCENT_FORMAT);
    expect(sheet.getCell('A4').font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
  });
});
