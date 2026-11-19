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
