// The ONLY place where the app does math (see CLAUDE.md, Calculation contract).
// The UI (live totals) and the Excel export both use these functions.
//
// Everything is done with scaled integers (BigInt), never floating point:
//   quantity   -> thousandths              (numeric(12,3))
//   money      -> cents                    (numeric(12,2))
//   percent    -> hundredths of a percent  (numeric(6,2) / numeric(5,2))
// Each rounding step rounds half away from zero to 2 decimals, at exactly the
// same steps as the ROUND() calls in the exported workbook, so the app and the
// file always match to the cent.

export type CalcType = 'fixed' | 'qty_price' | 'percent';

export type RowInput = {
  calc_type: CalcType;
  quantity: number | null;
  unit_price: number | null;
  percent: number | null;
};

export type ProjectTotals = {
  lineTotals: number[];
  subtotal: number; // sum of line totals (never clamped)
  tax: number; // round(subtotal * rate / 100, 2)
  total: number; // subtotal + tax
};

/** Converts a decimal number to an integer with `scale` decimals. A missing value counts as 0. */
function toScaled(value: number | null, scale: number): bigint {
  if (value === null || value === undefined) return 0n;
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${value}`);
  const scaled = value * 10 ** scale;
  const rounded = Math.round(scaled);
  // Values come from numeric(…, scale) columns, so they never have more decimals.
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new RangeError(`${value} has more than ${scale} decimals`);
  }
  return BigInt(rounded);
}

/** Integer division rounding half away from zero (divisor > 0). */
function divRound(numerator: bigint, divisor: bigint): bigint {
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const q = (abs * 2n + divisor) / (divisor * 2n);
  return negative ? -q : q;
}

const fromCents = (cents: bigint): number => Number(cents) / 100;

function lineTotalsInCents(rows: RowInput[]): bigint[] {
  const totals: bigint[] = [];
  let sumAbove = 0n;
  for (const row of rows) {
    let line: bigint;
    switch (row.calc_type) {
      case 'fixed':
        line = toScaled(row.unit_price, 2);
        break;
      case 'qty_price':
        // round(quantity × unit_price, 2): thousandths × cents = thousandths of a cent
        line = divRound(toScaled(row.quantity, 3) * toScaled(row.unit_price, 2), 1000n);
        break;
      case 'percent':
        // round(sum of all line totals above × percent / 100, 2); 0 for the first row
        line = divRound(sumAbove * toScaled(row.percent, 2), 10_000n);
        break;
      default: {
        const unknown: never = row.calc_type;
        throw new RangeError(`Unknown calc_type: ${String(unknown)}`);
      }
    }
    totals.push(line);
    sumAbove += line;
  }
  return totals;
}

/** Line total per row. `rows` must already be sorted by position. */
export function calcRows(rows: RowInput[]): number[] {
  return lineTotalsInCents(rows).map(fromCents);
}

/** Line totals, subtotal, tax and total after tax for a project. */
export function calcProject(rows: RowInput[], taxRatePercent: number): ProjectTotals {
  const lines = lineTotalsInCents(rows);
  const subtotal = lines.reduce((sum, line) => sum + line, 0n);
  const tax = divRound(subtotal * toScaled(taxRatePercent, 2), 10_000n);
  return {
    lineTotals: lines.map(fromCents),
    subtotal: fromCents(subtotal),
    tax: fromCents(tax),
    total: fromCents(subtotal + tax),
  };
}

/** True when discounts push the subtotal below 0. The UI shows a warning; the value is not clamped. */
export function isSubtotalNegative(totals: Pick<ProjectTotals, 'subtotal'>): boolean {
  return totals.subtotal < 0;
}
