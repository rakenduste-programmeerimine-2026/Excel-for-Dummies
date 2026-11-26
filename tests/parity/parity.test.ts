// Issue #12 / CLAUDE.md: "Any change to the calculation rules must be made in both lib/calc.ts and
// the Excel formulas, with a test proving the two match."
// Every case is exported with buildWorkbook, its cached results are overwritten with a sentinel,
// LibreOffice recalculates the formulas, and every total must equal calcProject to the cent.
import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import { calcProject } from '@/lib/calc';
import { buildWorkbook } from '@/lib/excel/buildWorkbook';
import { sheetLayout } from '@/lib/excel/layout';
import type { ExportData } from '@/lib/excel/types';
import { fixedRow, mockupProject, pctRow, qtyRow } from '../unit/fixtures';
import { libreOfficeAvailable, recalculate } from './libreoffice';

const SENTINEL = '-999999';

/** Replaces every cached formula result (<f>…</f><v>…</v>) so only a real recalculation can pass. */
async function withoutCachedResults(file: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(file);
  const path = 'xl/worksheets/sheet1.xml';
  const xml = await zip.file(path)!.async('string');
  const tampered = xml.replace(/(<f>[^<]*<\/f>)<v>[^<]*<\/v>/g, `$1<v>${SENTINEL}</v>`);
  if (!tampered.includes(SENTINEL)) throw new Error('no formula results found to replace');
  zip.file(path, tampered);
  return zip.generateAsync({ type: 'uint8array' });
}

function project(rows: ExportData['rows'], taxRate = 24, columns = 0): ExportData {
  const cols = Array.from({ length: columns }, (_, i) => ({ id: `c${i}`, name: `Veerg ${i + 1}` }));
  const base = mockupProject({ rows, columns: cols });
  return { ...base, project: { ...base.project, tax_rate: taxRate } };
}

/** Deterministic pseudo-random numbers, so a failure can be reproduced. */
function random(seed: number) {
  let s = seed;
  return () => ((s = (s * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
}

function randomProject(seed: number): ExportData {
  const next = random(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)]!;
  const decimals = (max: number, places: number) => Math.round(next() * max * 10 ** places) / 10 ** places;
  const rows = Array.from({ length: Math.floor(next() * 12) }, (_, i) => {
    const type = pick(['fixed', 'qty_price', 'qty_price', 'percent'] as const);
    if (type === 'fixed') return fixedRow(`Rida ${i}`, decimals(5000, 2) * (next() < 0.15 ? -1 : 1));
    if (type === 'qty_price') return qtyRow(`Rida ${i}`, decimals(500, 3), pick(['m²', 'h', 'tk']), decimals(300, 2));
    return pctRow(`Rida ${i}`, decimals(40, 2) * (next() < 0.5 ? -1 : 1));
  });
  return project(rows, pick([0, 9, 20, 22, 24, 25.5, 100]), Math.floor(next() * 4));
}

const cases: Record<string, ExportData> = {
  'design mockup': mockupProject(),
  'docs/database.md example': project([qtyRow('Seinte krohvimine', 10, 'm²', 4.5), qtyRow('Tööjõud', 8, 'h', 25), fixedRow('Transport', 30), pctRow('Allahindlus', -10)]),
  'each calc type on its own': project([fixedRow('A', 40)]),
  'quantity × price': project([qtyRow('A', 1.333, 'm²', 2.99)]),
  'percent row first': project([pctRow('Juurdehindlus', 15), fixedRow('A', 100)]),
  'two percent rows in a row': project([fixedRow('A', 365), pctRow('B', 15), pctRow('C', -10)]),
  'negative percent (discount)': project([fixedRow('A', 1000), pctRow('Allahindlus', -10)]),
  'rounding 0.005 up': project([fixedRow('A', 0.5), pctRow('B', 1)], 1),
  'rounding -0.005 down': project([fixedRow('A', 0.5), pctRow('B', -1)]),
  'rounding 1.005 (binary float trap)': project([fixedRow('A', 100.5), pctRow('B', 1)], 1),
  'rounding qty 0.001 × 5': project([qtyRow('A', 0.001, 'tk', 5)]),
  'rounding 2.675 trap': project([qtyRow('A', 0.5, 'tk', 5.35)], 50),
  'empty table': project([]),
  '0 % tax': project([qtyRow('A', 2, 'h', 9.99)], 0),
  'decimal tax rate': project([fixedRow('A', 100)], 25.5),
  'negative subtotal (not clamped)': project([fixedRow('A', 100), fixedRow('B', -150)]),
  'three extra columns': project([qtyRow('A', 3, 'h', 25), pctRow('B', 10), fixedRow('C', 5)], 24, 3),
  'large values': project([qtyRow('A', 1000, 'tk', 9_999_999.99), fixedRow('B', 0.01)]),
  ...Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`random #${i + 1}`, randomProject(i + 1)])),
};

const available = await libreOfficeAvailable();
if (!available && process.env.CI) throw new Error('LibreOffice (soffice) is required in CI for the parity test');

describe.skipIf(!available)('lib/calc.ts and the Excel formulas give the same totals (recalculated by LibreOffice)', () => {
  let sheets: Record<string, string[][]>;

  beforeAll(async () => {
    const files: Record<string, Uint8Array> = {};
    for (const [i, data] of Object.values(cases).entries()) files[`case-${i}`] = await withoutCachedResults(await buildWorkbook(data));
    const recalculated = await recalculate(files);
    sheets = Object.fromEntries(Object.keys(cases).map((name, i) => [name, recalculated[`case-${i}`]!]));
  }, 300_000);

  it.each(Object.keys(cases))('%s', (name) => {
    const data = cases[name]!;
    const sheet = sheets[name]!;
    const layout = sheetLayout(data.columns.length, data.rows.length);
    const cell = (row: number) => {
      const text = sheet[row - 1]?.[layout.col.total - 1] ?? '';
      expect(text, `row ${row} was not recalculated`).not.toBe(SENTINEL);
      return Number(text);
    };
    // Compare the exact values (only float noise allowed), NOT values rounded to cents:
    // rounding here would hide a formula that forgets ROUND (e.g. 90.6648 instead of 90.66).
    const same = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-9;
    const expected = calcProject(data.rows, data.project.tax_rate);
    const checks: [string, number, number][] = [
      ...data.rows.map((_, i): [string, number, number] => [`row ${i + 1}`, cell(layout.firstDataRow + i), expected.lineTotals[i]!]),
      ['Vahesumma', cell(layout.totalsRow.subtotal), expected.subtotal],
      ['Käibemaks', cell(layout.totalsRow.tax), expected.tax],
      ['Kokku koos käibemaksuga', cell(layout.totalsRow.total), expected.total],
    ];
    const mismatches = checks.filter(([, actual, exp]) => !same(actual, exp)).map(([what, actual, exp]) => `${what}: Excel ${actual}, app ${exp}`);
    expect(mismatches).toEqual([]);
  });
});
