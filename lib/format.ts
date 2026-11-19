// Display formatting for the UI, Estonian style. Calculations stay in lib/calc.ts.

// 'always' groups 4-digit amounts too (1 234,50 €); et-EE leaves them ungrouped by default.
// The cast is needed because tsconfig's lib (ES2022) types useGrouping as boolean only; 'always' is ES2023.
const eur = new Intl.NumberFormat('et-EE', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always' as unknown as boolean,
});

/** 1234.5 → "1 234,50 €" (non-breaking spaces, "−" for negatives). */
export function formatEur(amount: number): string {
  return eur.format(amount);
}

/** "2026-11-19" (Postgres date) → "19.11.2026". Plain string split, so no time-zone shift. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export type ParsedDecimal = number | null | 'invalid';

/**
 * Parses what the user typed into a number field. Accepts "12,50", "12.50", "1 234,5" and "−10".
 * Returns null for an empty field (or a lone "-" while typing), 'invalid' for anything else
 * that isn't a number with at most `maxDecimals` decimals.
 */
export function parseDecimal(text: string, maxDecimals: number): ParsedDecimal {
  const s = text.replace(/[\s ]/g, '').replace('−', '-').replace(',', '.');
  if (s === '' || s === '-') return null;
  const match = /^-?(?:\d+(?:\.(\d*))?|\.(\d+))$/.exec(s);
  if (!match) return 'invalid';
  const decimals = match[1] ?? match[2] ?? '';
  if (decimals.length > maxDecimals) return 'invalid';
  return Number(s);
}
