import { describe, expect, it } from 'vitest';
import { createProjectSchema, decimal, definedOnly, idSchema, taxRate, updateProjectSchema } from '@/lib/validation';

describe('decimal(): numbers typed the Estonian way', () => {
  const money = decimal(2);

  it.each([
    ['12,50', 12.5],
    ['12.50', 12.5],
    ['1 234,5', 1234.5],
    ['1 234,5', 1234.5], // non-breaking space
    ['−10', -10],
    ['-0', 0],
    [7, 7],
    [4.5, 4.5],
    ['', null],
    [null, null],
  ])('%j -> %j', (input, expected) => {
    expect(money.parse(input)).toBe(expected);
  });

  it.each(['12,345', 'abc', '1,2,3', '1e3', Number.NaN, Number.POSITIVE_INFINITY, 0.123, true, {}])('rejects %s in Estonian', (input) => {
    const r = money.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Sisesta number, kuni 2 kohta pärast koma (nt 12,50).');
  });

  it('applies bounds with their own messages', () => {
    const qty = decimal(3, { min: 0, minMessage: 'neg', max: 10, maxMessage: 'big' });
    expect(qty.safeParse('-1').error?.issues[0]?.message).toBe('neg');
    expect(qty.safeParse('11').error?.issues[0]?.message).toBe('big');
    expect(qty.parse('1,125')).toBe(1.125);
    expect(decimal(2, { max: 5 }).safeParse('6').error?.issues[0]?.message).toBe('Number on liiga suur.');
  });

  it('taxRate is 0..100 with two decimals', () => {
    expect(taxRate.parse('25,5')).toBe(25.5);
    expect(taxRate.safeParse('100,01').error?.issues[0]?.message).toBe('Käibemaksumäär peab olema vahemikus 0–100 %.');
    expect(taxRate.safeParse('-1').success).toBe(false);
  });
});

describe('project schemas', () => {
  it('trims, requires a name and turns empty optional text into null', () => {
    expect(createProjectSchema.parse({ name: '  Köök  ', client: '', address: ' Õie 5 ' })).toEqual({ name: 'Köök', client: null, address: 'Õie 5' });
    expect(createProjectSchema.safeParse({ name: '   ' }).error?.issues[0]?.message).toBe('Sisesta projekti nimi.');
    expect(createProjectSchema.safeParse({ name: 'x'.repeat(201) }).error?.issues[0]?.message).toBe('Kuni 200 märki.');
  });

  it('update keeps undefined fields out and rejects an empty tax rate', () => {
    expect(definedOnly(updateProjectSchema.parse({ tax_rate: '22' }))).toEqual({ tax_rate: 22 });
    expect(updateProjectSchema.safeParse({ tax_rate: '' }).success).toBe(false);
    expect(updateProjectSchema.parse({ client: null })).toMatchObject({ client: null });
  });

  it('idSchema accepts uuids only', () => {
    expect(idSchema.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true);
    expect(idSchema.safeParse('1; drop table').success).toBe(false);
  });
});
