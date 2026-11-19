import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { calcProject } from '@/lib/calc';
import { buildWorkbook, buildWorksheet } from '@/lib/excel/buildWorkbook';
import { fixedRow, mockupProject, pctRow, qtyRow } from './fixtures';

const sheetFor = (data = mockupProject()) => buildWorksheet(new ExcelJS.Workbook(), data);
const formula = (sheet: ExcelJS.Worksheet, address: string) => sheet.getCell(address).formula;
// cell.result reads the stored value directly; exceljs's .value getter hides a falsy result such as 0.
const result = (sheet: ExcelJS.Worksheet, address: string) => sheet.getCell(address).result;

describe('row formulas (design mockup, one extra column)', () => {
  const sheet = sheetFor();

  it('uses the formula of each calc type', () => {
    expect(['H5', 'H6', 'H7', 'H8', 'H9'].map((a) => formula(sheet, a))).toEqual([
      'ROUND(E5*G5,2)', // qty_price
      'ROUND(E6*G6,2)', // qty_price
      'G7', // fixed
      'ROUND(SUM(H5:H7)*E8,2)', // percent of the rows above
      'ROUND(SUM(H5:H8)*E9,2)', // includes the percent row above it
    ]);
  });

  it('stores the cached result from calcProject on every formula cell', () => {
    expect(['H5', 'H6', 'H7', 'H8', 'H9'].map((a) => result(sheet, a))).toEqual([125, 200, 40, 54.75, -41.98]);
  });

  it('writes the totals block with formulas and its own tax rate cell', () => {
    expect(formula(sheet, 'H11')).toBe('SUM(H5:H9)');
    expect(sheet.getCell('H12').value).toBe(0.24);
    expect(formula(sheet, 'H13')).toBe('ROUND(H11*H12,2)');
    expect(formula(sheet, 'H14')).toBe('H11+H13');
    expect(['H11', 'H13', 'H14'].map((a) => result(sheet, a))).toEqual([377.77, 90.66, 468.43]);
  });
});

describe('column letters follow the extra columns', () => {
  it('no extra columns: Summa in G', () => {
    const sheet = sheetFor(mockupProject({ columns: [] }));
    expect(formula(sheet, 'G5')).toBe('ROUND(D5*F5,2)');
    expect(formula(sheet, 'G7')).toBe('F7');
    expect(formula(sheet, 'G9')).toBe('ROUND(SUM(G5:G8)*D9,2)');
    expect(formula(sheet, 'G13')).toBe('ROUND(G11*G12,2)');
  });

  it('three extra columns: Summa in J', () => {
    const columns = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() }));
    const sheet = sheetFor(mockupProject({ columns }));
    expect(formula(sheet, 'J5')).toBe('ROUND(G5*I5,2)');
    expect(formula(sheet, 'J8')).toBe('ROUND(SUM(J5:J7)*G8,2)');
    expect(formula(sheet, 'J11')).toBe('SUM(J5:J9)');
  });
});

describe('edge cases', () => {
  it('a percent row as the first row is the formula 0', () => {
    const sheet = sheetFor(mockupProject({ columns: [], rows: [pctRow('Juurdehindlus', 15), fixedRow('Töö', 100)] }));
    expect(formula(sheet, 'G5')).toBe('0');
    expect(result(sheet, 'G5')).toBe(0);
    expect(formula(sheet, 'G6')).toBe('F6');
  });

  it('a project with zero rows exports with totals of 0', () => {
    const sheet = sheetFor(mockupProject({ columns: [], rows: [] }));
    expect(formula(sheet, 'G6')).toBe('0');
    expect([6, 8, 9].map((r) => result(sheet, `G${r}`))).toEqual([0, 0, 0]);
  });

  it('a 0 % tax rate', () => {
    const data = mockupProject();
    const sheet = sheetFor({ ...data, project: { ...data.project, tax_rate: 0 } });
    expect(sheet.getCell('H12').value).toBe(0);
    expect(result(sheet, 'H13')).toBe(0);
    expect(result(sheet, 'H14')).toBe(377.77);
  });

  it('the docs/database.md example', () => {
    const sheet = sheetFor(
      mockupProject({
        columns: [],
        rows: [qtyRow('Seinte krohvimine', 10, 'm²', 4.5), qtyRow('Tööjõud', 8, 'h', 25), fixedRow('Transport', 30), pctRow('Allahindlus', -10)],
      }),
    );
    expect([5, 6, 7, 8].map((r) => result(sheet, `G${r}`))).toEqual([45, 200, 30, -27.5]);
    expect([10, 12, 13].map((r) => result(sheet, `G${r}`))).toEqual([247.5, 59.4, 306.9]);
  });

  it('no calculated cell holds a plain number', () => {
    const sheet = sheetFor(mockupProject({ rows: [qtyRow('A', 3, 'h', 25), pctRow('B', 10), fixedRow('C', 5), pctRow('D', -5)] }));
    for (const r of [5, 6, 7, 8, 10, 12, 13]) expect(formula(sheet, `H${r}`), `H${r}`).toBeTruthy();
  });
});

describe('the saved .xlsx file', () => {
  it('keeps formulas and cached results after writing and reading', async () => {
    const data = mockupProject();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(data)) as unknown as ArrayBuffer);
    const sheet = wb.worksheets[0]!;
    expect(sheet.name).toBe('Köögi remont');
    expect(formula(sheet, 'H9')).toBe('ROUND(SUM(H5:H8)*E9,2)');
    expect(result(sheet, 'H9')).toBe(-41.98);
    expect(result(sheet, 'H14')).toBe(calcProject(data.rows, data.project.tax_rate).total);
  });

  it('stores cached results of 0 in the file (previews would otherwise show empty totals)', async () => {
    const file = await buildWorkbook(mockupProject({ columns: [], rows: [] }));
    const xml = await (await JSZip.loadAsync(file)).file('xl/worksheets/sheet1.xml')!.async('string');
    expect(xml).toContain('<c r="G6"><f>0</f><v>0</v></c>');
    expect(xml).toContain('<c r="G8"><f>ROUND(G6*G7,2)</f><v>0</v></c>');
    expect(xml).toContain('<c r="G9"><f>G6+G8</f><v>0</v></c>');
  });
});
