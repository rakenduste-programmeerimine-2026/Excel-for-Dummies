import { describe, expect, it } from 'vitest';
import { calcProject, calcRows, isSubtotalNegative, type RowInput } from '@/lib/calc';

const fixed = (unit_price: number | null): RowInput => ({ calc_type: 'fixed', quantity: null, unit_price, percent: null });
const qty = (quantity: number | null, unit_price: number | null): RowInput => ({ calc_type: 'qty_price', quantity, unit_price, percent: null });
const pct = (percent: number | null): RowInput => ({ calc_type: 'percent', quantity: null, unit_price: null, percent });

describe('each calc type on its own', () => {
  it('fixed: the unit price', () => {
    expect(calcRows([fixed(40)])).toEqual([40]);
    expect(calcRows([fixed(-500)])).toEqual([-500]);
  });

  it('qty_price: quantity × unit price, rounded to cents', () => {
    expect(calcRows([qty(10, 4.5)])).toEqual([45]); // 10 m² × 4,50 €
    expect(calcRows([qty(8, 25)])).toEqual([200]); // 8 h × 25 €
    expect(calcRows([qty(1.333, 2.99)])).toEqual([3.99]); // 3.98567 -> 3.99
  });

  it('percent: % of all rows above', () => {
    expect(calcRows([fixed(100), fixed(200), pct(15)])).toEqual([100, 200, 45]);
  });
});

describe('percent rows', () => {
  it('a percent row as the first row is 0', () => {
    expect(calcRows([pct(15), fixed(100)])).toEqual([0, 100]);
  });

  it('two percent rows in a row: the second includes the first', () => {
    // markup 15 % of 365 = 54.75; discount -10 % of 419.75 = -41.975 -> -41.98
    expect(calcRows([qty(10, 12.5), qty(8, 25), fixed(40), pct(15), pct(-10)])).toEqual([125, 200, 40, 54.75, -41.98]);
  });

  it('negative percents are discounts', () => {
    expect(calcProject([fixed(1000), pct(-10)], 24)).toEqual({ lineTotals: [1000, -100], subtotal: 900, tax: 216, total: 1116 });
  });

  it('reordering rows changes the percent results', () => {
    const a = fixed(100);
    const b = fixed(300);
    const p = pct(10);
    expect(calcRows([a, p, b])).toEqual([100, 10, 300]);
    expect(calcRows([a, b, p])).toEqual([100, 300, 40]);
    expect(calcRows([p, a, b])).toEqual([0, 100, 300]);
  });
});

describe('rounding: half away from zero (like Excel ROUND)', () => {
  it('0.005 rounds up and -0.005 rounds down', () => {
    expect(calcRows([fixed(0.5), pct(1)])).toEqual([0.5, 0.01]);
    expect(calcRows([fixed(0.5), pct(-1)])).toEqual([0.5, -0.01]);
    expect(calcRows([fixed(0.4), pct(1)])).toEqual([0.4, 0]);
    expect(calcRows([qty(0.001, 5)])).toEqual([0.01]);
  });

  it('tax of 0.005 rounds up', () => {
    expect(calcProject([fixed(0.5)], 1).tax).toBe(0.01);
  });

  it('has no floating point drift', () => {
    expect(calcProject([fixed(0.1), fixed(0.2)], 0).subtotal).toBe(0.3);
    expect(calcRows([qty(3, 1.1)])).toEqual([3.3]);
  });
});

describe('calcProject', () => {
  it('the example from docs/database.md', () => {
    expect(calcProject([qty(10, 4.5), qty(8, 25), fixed(30), pct(-10)], 24)).toEqual({
      lineTotals: [45, 200, 30, -27.5],
      subtotal: 247.5,
      tax: 59.4,
      total: 306.9,
    });
  });

  it('the export mockup from docs/backend/design.md', () => {
    expect(calcProject([qty(10, 12.5), qty(8, 25), fixed(40), pct(15), pct(-10)], 24)).toEqual({
      lineTotals: [125, 200, 40, 54.75, -41.98],
      subtotal: 377.77,
      tax: 90.66,
      total: 468.43,
    });
  });

  it('an empty table is all zeros', () => {
    expect(calcProject([], 24)).toEqual({ lineTotals: [], subtotal: 0, tax: 0, total: 0 });
  });

  it('a 0 % tax rate', () => {
    expect(calcProject([qty(2, 9.99)], 0)).toEqual({ lineTotals: [19.98], subtotal: 19.98, tax: 0, total: 19.98 });
  });

  it('a decimal tax rate', () => {
    expect(calcProject([fixed(100)], 25.5)).toMatchObject({ tax: 25.5, total: 125.5 });
  });

  it('large values stay exact to the cent', () => {
    expect(calcProject([qty(1000, 9_999_999.99), fixed(0.01)], 24)).toEqual({
      lineTotals: [9_999_999_990, 0.01],
      subtotal: 9_999_999_990.01,
      tax: 2_399_999_997.6,
      total: 12_399_999_987.61,
    });
  });

  it('treats a missing value as 0 while the user is still typing', () => {
    expect(calcRows([qty(null, 10), qty(2, null), fixed(null), fixed(5), pct(null)])).toEqual([0, 0, 0, 5, 0]);
  });

  it('does not clamp a negative subtotal', () => {
    const totals = calcProject([fixed(100), fixed(-150)], 24);
    expect(totals).toEqual({ lineTotals: [100, -150], subtotal: -50, tax: -12, total: -62 });
    expect(isSubtotalNegative(totals)).toBe(true);
    expect(isSubtotalNegative(calcProject([fixed(100), pct(-100)], 24))).toBe(false);
  });
});

describe('invalid input', () => {
  it('rejects values with more decimals than the database allows', () => {
    expect(() => calcRows([fixed(1.234)])).toThrow('more than 2 decimals');
    expect(() => calcRows([qty(1.2345, 1)])).toThrow('more than 3 decimals');
  });

  it('rejects NaN and Infinity', () => {
    expect(() => calcRows([fixed(Number.NaN)])).toThrow('finite');
    expect(() => calcProject([], Number.POSITIVE_INFINITY)).toThrow('finite');
  });

  it('rejects an unknown calc type', () => {
    expect(() => calcRows([{ ...fixed(1), calc_type: 'formula' as never }])).toThrow('Unknown calc_type');
  });
});
