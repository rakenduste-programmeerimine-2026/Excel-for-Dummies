import { describe, expect, it } from 'vitest';
import { formatDate, formatEur } from '@/lib/format';

const NBSP = ' ';

describe('formatEur', () => {
  it('formats with comma decimals and the € sign after the amount', () => {
    expect(formatEur(12.5)).toBe(`12,50${NBSP}€`);
  });

  it('groups thousands, including 4-digit amounts', () => {
    expect(formatEur(1234.5)).toBe(`1${NBSP}234,50${NBSP}€`);
    expect(formatEur(1234567.89)).toBe(`1${NBSP}234${NBSP}567,89${NBSP}€`);
  });

  it('formats zero and negatives', () => {
    expect(formatEur(0)).toBe(`0,00${NBSP}€`);
    expect(formatEur(-41.98)).toBe(`−41,98${NBSP}€`);
  });

  it('always shows 2 decimals', () => {
    expect(formatEur(200)).toBe(`200,00${NBSP}€`);
    expect(formatEur(0.125)).toBe(`0,13${NBSP}€`);
  });
});

describe('formatDate', () => {
  it('turns a Postgres date into dd.mm.yyyy', () => {
    expect(formatDate('2026-11-19')).toBe('19.11.2026');
    expect(formatDate('2027-01-02')).toBe('02.01.2027');
  });
});
