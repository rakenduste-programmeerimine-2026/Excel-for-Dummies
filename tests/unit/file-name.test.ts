import { describe, expect, it } from 'vitest';
import { asciiFallback, contentDisposition, exportFileName, isoDateInTallinn } from '@/lib/excel/fileName';

const date = new Date('2026-11-19T10:00:00Z');

describe('exportFileName: <project-name>-<yyyy-mm-dd>.xlsx', () => {
  it('keeps Estonian letters and spaces', () => {
    expect(exportFileName('Õie tänav 5', date)).toBe('Õie tänav 5-2026-11-19.xlsx');
  });

  it('replaces characters Windows forbids in file names', () => {
    expect(exportFileName('Köök/vannituba: "etapp" 1?*<>|\\', date)).toBe('Köök-vannituba- -etapp- 1-------2026-11-19.xlsx');
  });

  it('cleans whitespace, leading dots and empty names', () => {
    expect(exportFileName('  Köök \n remont  ', date)).toBe('Köök remont-2026-11-19.xlsx');
    expect(exportFileName('..hidden', date)).toBe('hidden-2026-11-19.xlsx');
    expect(exportFileName('   ', date)).toBe('projekt-2026-11-19.xlsx');
  });

  it('shortens very long names', () => {
    expect(exportFileName('x'.repeat(300), date)).toBe(`${'x'.repeat(120)}-2026-11-19.xlsx`);
  });

  it('uses the date in Tallinn (UTC+2/+3)', () => {
    expect(isoDateInTallinn(new Date('2026-11-19T22:30:00Z'))).toBe('2026-11-20');
    expect(isoDateInTallinn(new Date('2026-07-01T20:59:00Z'))).toBe('2026-07-01');
    expect(isoDateInTallinn(new Date('2026-07-01T21:00:00Z'))).toBe('2026-07-02');
  });
});

describe('contentDisposition (RFC 5987)', () => {
  it('sends an ASCII fallback and the UTF-8 name', () => {
    expect(contentDisposition('Õie tänav 5-2026-11-19.xlsx')).toBe(
      `attachment; filename="Oie tanav 5-2026-11-19.xlsx"; filename*=UTF-8''%C3%95ie%20t%C3%A4nav%205-2026-11-19.xlsx`,
    );
  });

  it('percent-encodes characters that are not RFC 5987 attr-chars', () => {
    expect(contentDisposition("O'Brien (1)*.xlsx")).toContain(`filename*=UTF-8''O%27Brien%20%281%29%2A.xlsx`);
  });

  it('never puts quotes, backslashes or non-ASCII into the fallback', () => {
    expect(asciiFallback('a"b\\c€ž.xlsx')).toBe('a_b_c_z.xlsx');
  });
});
