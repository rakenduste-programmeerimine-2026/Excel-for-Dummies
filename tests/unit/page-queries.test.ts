import { describe, expect, it } from 'vitest';
import { getProfile, getProjectForEditor, listProjects } from '@/lib/queries';
import { updateProfile } from '@/lib/actions/projects';
import { C1, C2, fakeSupabase, P1, P2, R, sampleTables } from './fake-supabase';

const P3 = '33333333-3333-4333-8333-333333333333';

function tablesWithSecondProject() {
  const tables = sampleTables();
  tables.projects![0]!.created_at = '2026-11-01T10:00:00Z';
  tables.projects!.push({ id: P3, user_id: 'user-1', name: 'Vannituba', client: null, address: null, tax_rate: '22.00', created_at: '2026-11-20T10:00:00Z' });
  return tables;
}

describe('listProjects', () => {
  it("lists only the user's projects, newest first, with totals that match the export", async () => {
    const { client } = fakeSupabase(tablesWithSecondProject());
    expect(await listProjects(client)).toEqual([
      { id: P3, name: 'Vannituba', client: null, address: null, tax_rate: 22, created_at: '2026-11-20T10:00:00Z', rowCount: 0, subtotal: 0, tax: 0, total: 0 },
      {
        id: P1,
        name: 'Õie tänav 5',
        client: 'Mari Maasikas',
        address: 'Õie tänav 5, Tallinn',
        tax_rate: 24,
        created_at: '2026-11-01T10:00:00Z',
        rowCount: 4,
        subtotal: 247.5, // docs/database.md example: rows sorted by position before calculating
        tax: 59.4,
        total: 306.9,
      },
    ]);
  });

  it('loads all rows in one query, filtered to those projects', async () => {
    const { client, log } = fakeSupabase(tablesWithSecondProject());
    await listProjects(client);
    expect(log.filter((q) => q.table === 'rows')).toHaveLength(1);
    expect(log.find((q) => q.table === 'rows')?.orders).toEqual(['position', 'created_at']);
  });

  it('returns [] without querying rows when there are no projects', async () => {
    const tables = sampleTables();
    tables.projects = tables.projects!.filter((p) => p.id === P2);
    const { client, log } = fakeSupabase(tables);
    expect(await listProjects(client)).toEqual([]);
    expect(log.some((q) => q.table === 'rows')).toBe(false);
  });

  it('throws when a query fails', async () => {
    await expect(listProjects(fakeSupabase(sampleTables(), { failOn: 'projects' }).client)).rejects.toThrow('Loading projects failed');
    await expect(listProjects(fakeSupabase(sampleTables(), { failOn: 'rows' }).client)).rejects.toThrow('Loading rows failed');
  });
});

describe('getProfile', () => {
  it("returns the signed-in user's business name and default käibemaks", async () => {
    expect(await getProfile(fakeSupabase(sampleTables()).client)).toEqual({ business_name: 'Kodu Remont OÜ', default_tax_rate: 24 });
  });

  it('reflects updateProfile', async () => {
    const { client } = fakeSupabase(sampleTables());
    await updateProfile(client, { business_name: 'Uus OÜ', default_tax_rate: '22' });
    expect(await getProfile(client)).toEqual({ business_name: 'Uus OÜ', default_tax_rate: 22 });
  });

  it('null when signed out or there is no profile; throws on errors', async () => {
    expect(await getProfile(fakeSupabase(sampleTables(), { user: null }).client)).toBeNull();
    const tables = sampleTables();
    tables.profiles = [];
    expect(await getProfile(fakeSupabase(tables).client)).toBeNull();
    await expect(getProfile(fakeSupabase(sampleTables(), { failOn: 'profiles' }).client)).rejects.toThrow('Loading profile failed');
  });
});

describe('getProjectForEditor', () => {
  it('returns the project, its extra columns and rows in position order', async () => {
    const data = await getProjectForEditor(fakeSupabase(sampleTables()).client, P1);
    expect(data?.project).toEqual({ id: P1, name: 'Õie tänav 5', client: 'Mari Maasikas', address: 'Õie tänav 5, Tallinn', tax_rate: 24 });
    expect(data?.columns).toEqual([
      { id: C1, name: 'Ruum', position: 1 },
      { id: C2, name: 'Tarnija', position: 2 },
    ]);
    expect(data?.rows.map((r) => r.id)).toEqual([R(1), R(2), R(3), R(4)]);
    expect(data?.rows[0]).toEqual({
      id: R(1),
      project_id: P1,
      position: 1,
      date: '2026-11-02',
      description: 'Seinte krohvimine',
      calc_type: 'qty_price',
      quantity: 10,
      unit: 'm²',
      unit_price: 4.5,
      percent: null,
      extra: { [C1]: 'Köök', gone: 'x', n: '5' },
    });
    expect(data?.rows[1]).toMatchObject({ quantity: 8, extra: {} }); // '8.000' and null extra normalised
  });

  it("null for a malformed id, a missing project or someone else's", async () => {
    const { client, log } = fakeSupabase(sampleTables());
    expect(await getProjectForEditor(client, 'nope')).toBeNull();
    expect(log).toHaveLength(0); // malformed id: no query at all
    expect(await getProjectForEditor(client, P3)).toBeNull();
    expect(await getProjectForEditor(client, P2)).toBeNull();
  });

  it('throws when a query fails', async () => {
    for (const [table, message] of [['projects', 'Loading project failed'], ['project_columns', 'Loading columns failed'], ['rows', 'Loading rows failed']] as const) {
      await expect(getProjectForEditor(fakeSupabase(sampleTables(), { failOn: table }).client, P1)).rejects.toThrow(message);
    }
  });
});
