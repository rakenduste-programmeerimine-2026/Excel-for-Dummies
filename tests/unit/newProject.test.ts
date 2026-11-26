import { describe, expect, it } from 'vitest';
import { readNewProjectForm, taxRateText } from '@/app/projects/newProject';
import { validation } from '@/lib/strings.et';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe('readNewProjectForm', () => {
  const base = { name: 'Õie tänav 5', client: 'Mari', address: 'Tartu' };

  it('needs no tax rate update when the default is kept', () => {
    expect(readNewProjectForm(form({ ...base, tax_rate: '24' }), 24)).toEqual({ ok: true, input: base, taxRate: null });
  });

  it('returns a changed rate, accepting a decimal comma', () => {
    expect(readNewProjectForm(form({ ...base, tax_rate: '22,5' }), 24)).toMatchObject({ ok: true, taxRate: 22.5 });
  });

  it('rejects an empty, out-of-range or non-numeric rate before anything is created', () => {
    for (const tax_rate of ['', '101', '-1', 'abc']) {
      expect(readNewProjectForm(form({ ...base, tax_rate }), 24)).toMatchObject({ ok: false });
    }
    expect(readNewProjectForm(form({ ...base, tax_rate: '101' }), 24)).toEqual({ ok: false, error: validation.taxRateRange });
  });
});

describe('taxRateText', () => {
  it('shows the default the Estonian way', () => {
    expect(taxRateText(24)).toBe('24');
    expect(taxRateText(22.5)).toBe('22,5');
  });
});
