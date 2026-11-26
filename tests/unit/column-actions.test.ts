import { afterEach, describe, expect, it, vi } from 'vitest';
import { addColumn, deleteColumn, renameColumn } from '@/lib/actions/columns';
import { exportProject } from '@/lib/exportProject';
import ExcelJS from 'exceljs';
import { C1, C2, fakeSupabase, P1, P2, R, sampleTables } from './fake-supabase';

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});
const NEW = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const C9 = 'cccccccc-cccc-4ccc-8ccc-000000000009';

describe('addColumn ("Lisa veerg")', () => {
  it('adds a text column at the right end', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await addColumn(client, P1, { name: '  Märkus ', id: NEW })).toEqual({ ok: true, data: { id: NEW, project_id: P1, name: 'Märkus', position: 3 } });
  });

  it('starts at position 1 when the project has no columns', async () => {
    const tables = sampleTables();
    tables.project_columns = [];
    expect(await addColumn(fakeSupabase(tables).client, P1, { name: 'Ruum' })).toMatchObject({ ok: true, data: { position: 1 } });
  });

  it('asks for a name, in Estonian', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await addColumn(client, P1, { name: '  ' })).toMatchObject({ ok: false, error: 'Sisesta veeru nimi.' });
    expect(await addColumn(client, P1, { name: 'x'.repeat(101) })).toMatchObject({ ok: false, error: 'Kuni 100 märki.' });
  });

  it("can't add to someone else's project; bad ids, sessions and errors handled", async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await addColumn(client, P2, { name: 'X' })).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(await addColumn(client, 'x', { name: 'X' })).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(await addColumn(client, P1, { name: 'X', id: 'x' })).toEqual({ ok: false, error: 'Vigane viide. Laadi leht uuesti.' });
    expect(await addColumn(fakeSupabase(sampleTables(), { user: null }).client, P1, { name: 'X' })).toMatchObject({ ok: false });
    quiet();
    for (const table of ['projects', 'project_columns']) {
      expect(await addColumn(fakeSupabase(sampleTables(), { failOn: table }).client, P1, { name: 'X' })).toMatchObject({ ok: false });
    }
  });
});

describe('renameColumn', () => {
  it('renames the column; row values (keyed by id) stay', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await renameColumn(client, C1, 'Tuba')).toEqual({ ok: true, data: null });
    expect(tables.project_columns!.find((c) => c.id === C1)?.name).toBe('Tuba');
    expect(tables.rows!.find((r) => r.id === R(1))?.extra).toMatchObject({ [C1]: 'Köök' });
  });

  it('validates the name and handles missing columns, sessions and errors', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await renameColumn(client, C1, '')).toMatchObject({ ok: false, error: 'Sisesta veeru nimi.' });
    expect(await renameColumn(client, C9, 'X')).toEqual({ ok: false, error: 'Veergu ei leitud.' });
    expect(await renameColumn(client, 'x', 'X')).toEqual({ ok: false, error: 'Veergu ei leitud.' });
    expect(await renameColumn(fakeSupabase(sampleTables(), { user: null }).client, C1, 'X')).toMatchObject({ ok: false });
    quiet();
    expect(await renameColumn(fakeSupabase(sampleTables(), { failOn: 'project_columns' }).client, C1, 'X')).toMatchObject({ ok: false });
  });
});

describe('deleteColumn', () => {
  it('removes the column and its values from every row (delete_column RPC)', async () => {
    const { client, tables, log } = fakeSupabase(sampleTables());
    expect(await deleteColumn(client, C1)).toEqual({ ok: true, data: null });
    expect(tables.project_columns!.map((c) => c.id)).toEqual([C2]);
    expect(tables.rows!.find((r) => r.id === R(1))?.extra).not.toHaveProperty(C1);
    expect(log.find((q) => q.op === 'rpc')).toMatchObject({ table: 'delete_column', payload: { p_column_id: C1 } });
  });

  it('a deleted column disappears from the export', async () => {
    const { client } = fakeSupabase(sampleTables());
    await deleteColumn(client, C1);
    const res = await exportProject(client, P1, new Date('2026-11-19T10:00:00Z'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(await res.arrayBuffer()).buffer as ArrayBuffer);
    const header = (wb.worksheets[0]!.getRow(4).values as unknown[]).slice(1);
    expect(header).toEqual(['Nr', 'Kuupäev', 'Kirjeldus', 'Tarnija', 'Kogus', 'Ühik', 'Ühiku hind', 'Summa']);
  });

  it('says "not found" when the column disappears between the check and the delete (another tab)', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    type Rpc = (name: string, args: unknown) => Promise<unknown>;
    const fake = client as unknown as { rpc: Rpc };
    const realRpc = fake.rpc;
    fake.rpc = (name, args) => {
      tables.project_columns = tables.project_columns!.filter((c) => c.id !== C1); // deleted elsewhere
      return realRpc(name, args);
    };
    expect(await deleteColumn(client, C1)).toEqual({ ok: false, error: 'Veergu ei leitud.' });
  });

  it("can't delete a column it can't see; bad ids, sessions and errors handled", async () => {
    const tables = sampleTables();
    tables.project_columns!.push({ id: C9, project_id: P2, name: 'Not yours', position: 1 });
    const { client } = fakeSupabase(tables);
    expect(await deleteColumn(client, C9)).toEqual({ ok: false, error: 'Veergu ei leitud.' });
    expect(tables.project_columns!.some((c) => c.id === C9)).toBe(true);
    expect(await deleteColumn(client, 'x')).toEqual({ ok: false, error: 'Veergu ei leitud.' });
    expect(await deleteColumn(fakeSupabase(sampleTables(), { user: null }).client, C1)).toMatchObject({ ok: false });
    quiet();
    expect(await deleteColumn(fakeSupabase(sampleTables(), { failOn: 'delete_column' }).client, C1)).toMatchObject({ ok: false });
    expect(await deleteColumn(fakeSupabase(sampleTables(), { failOn: 'project_columns' }).client, C1)).toMatchObject({ ok: false });
  });
});
