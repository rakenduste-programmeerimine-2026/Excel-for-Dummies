import { describe, expect, it } from 'vitest';
import { calcProject } from '@/lib/calc';
import { getProjectForExport, toExtra, toNumber } from '@/lib/queries';
import { fakeSupabase, sampleTables } from './fake-supabase';

describe('getProjectForExport', () => {
  it('loads the project, business name, columns and rows in position order', async () => {
    const { client } = fakeSupabase(sampleTables());
    const data = await getProjectForExport(client, 'p1');
    expect(data?.businessName).toBe('Kodu Remont OÜ');
    expect(data?.project).toEqual({ name: 'Õie tänav 5', client: 'Mari Maasikas', address: 'Õie tänav 5, Tallinn', tax_rate: 24 });
    expect(data?.columns).toEqual([{ id: 'c1', name: 'Ruum' }, { id: 'c2', name: 'Tarnija' }]);
    expect(data?.rows.map((r) => r.description)).toEqual(['Seinte krohvimine', 'Tööjõud', 'Transport', 'Allahindlus']);
  });

  it('converts numeric strings to numbers, so calcProject gives the docs/database.md totals', async () => {
    const { client } = fakeSupabase(sampleTables());
    const data = (await getProjectForExport(client, 'p1'))!;
    expect(data.rows[1]).toMatchObject({ quantity: 8, unit_price: 25 });
    expect(data.rows[2]).toMatchObject({ unit_price: 30 });
    expect(calcProject(data.rows, data.project.tax_rate)).toMatchObject({ subtotal: 247.5, tax: 59.4, total: 306.9 });
  });

  it('keeps only text values in extra', async () => {
    const { client } = fakeSupabase(sampleTables());
    const data = (await getProjectForExport(client, 'p1'))!;
    expect(data.rows[0]!.extra).toEqual({ c1: 'Köök', gone: 'x', n: '5' });
    expect(data.rows[1]!.extra).toEqual({});
    expect(data.rows[3]!.extra).toEqual({});
  });

  it('filters every query by the project and orders by position', async () => {
    const { client, log } = fakeSupabase(sampleTables());
    await getProjectForExport(client, 'p1');
    expect(log.find((q) => q.table === 'project_columns')).toMatchObject({ filters: [['project_id', 'p1']], orders: ['position'] });
    expect(log.find((q) => q.table === 'rows')).toMatchObject({ filters: [['project_id', 'p1']], orders: ['position', 'created_at'] });
    expect(log.find((q) => q.table === 'profiles')).toMatchObject({ filters: [['id', 'user-1']] });
  });

  it('returns null for a missing project or one RLS hides', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await getProjectForExport(client, 'nope')).toBeNull();
    expect(await getProjectForExport(client, 'p2')).toBeNull();
  });

  it('handles a project without a profile, columns or rows', async () => {
    const tables = sampleTables();
    const { client } = fakeSupabase({ projects: tables.projects ?? [] });
    expect(await getProjectForExport(client, 'p1')).toMatchObject({ businessName: null, columns: [], rows: [] });
  });

  it('throws when a query fails', async () => {
    for (const table of ['projects', 'profiles', 'project_columns', 'rows']) {
      const { client } = fakeSupabase(sampleTables(), { failOn: table });
      await expect(getProjectForExport(client, 'p1'), table).rejects.toThrow('exploded');
    }
  });
});

describe('helpers', () => {
  it('toNumber accepts numbers and numeric strings', () => {
    expect(toNumber(4.5)).toBe(4.5);
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(null)).toBeNull();
    expect(() => toNumber('abc')).toThrow('Not a number');
  });

  it('toExtra ignores anything that is not an object of texts', () => {
    expect(toExtra('x')).toEqual({});
    expect(toExtra(null)).toEqual({});
    expect(toExtra([1])).toEqual({});
    expect(toExtra({ a: 'b', c: true })).toEqual({ a: 'b' });
  });
});
