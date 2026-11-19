import { describe, expect, it } from 'vitest';
import { formatDate, formatEur, parseDecimal } from '@/lib/format';

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

describe('parseDecimal', () => {
  it('accepts comma and dot as the decimal separator', () => {
    expect(parseDecimal('12,50', 2)).toBe(12.5);
    expect(parseDecimal('12.50', 2)).toBe(12.5);
  });

  it('accepts thousands spaces, negatives and partial input', () => {
    expect(parseDecimal('1 234,5', 2)).toBe(1234.5);
    expect(parseDecimal('1 234,5', 2)).toBe(1234.5);
    expect(parseDecimal('-10', 2)).toBe(-10);
    expect(parseDecimal('−10', 2)).toBe(-10);
    expect(parseDecimal('12,', 2)).toBe(12);
    expect(parseDecimal(',5', 2)).toBe(0.5);
  });

  it('returns null for an empty field or a lone minus', () => {
    expect(parseDecimal('', 2)).toBeNull();
    expect(parseDecimal('  ', 2)).toBeNull();
    expect(parseDecimal('-', 2)).toBeNull();
  });

  it('rejects too many decimals', () => {
    expect(parseDecimal('12,555', 2)).toBe('invalid');
    expect(parseDecimal('1,2345', 3)).toBe('invalid');
    expect(parseDecimal('1,234', 3)).toBe(1.234);
  });

  it('rejects junk', () => {
    expect(parseDecimal('abc', 2)).toBe('invalid');
    expect(parseDecimal('1,2,3', 2)).toBe('invalid');
    expect(parseDecimal('1.234,5', 2)).toBe('invalid');
    expect(parseDecimal('12€', 2)).toBe('invalid');
  });
});
