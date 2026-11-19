import { afterEach, describe, expect, it, vi } from 'vitest';
import { addRow, deleteRow, duplicateRow, reorderRows, updateRow } from '@/lib/actions/rows';
import { calcProject } from '@/lib/calc';
import { getProjectForExport } from '@/lib/queries';
import { C1, fakeSupabase, P1, P2, R, sampleTables } from './fake-supabase';

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});
const NEW = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';

const order = (tables: ReturnType<typeof sampleTables>) =>
  tables.rows!.filter((r) => r.project_id === P1).sort((a, b) => (a.position as number) - (b.position as number)).map((r) => r.description);

describe('addRow ("Lisa rida")', () => {
  it('appends an empty fixed row at the end, with the id the editor chose', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    const result = await addRow(client, P1, { id: NEW });
    expect(result).toMatchObject({ ok: true, data: { id: NEW, project_id: P1, position: 5, description: '', calc_type: 'fixed', unit_price: 0, extra: {} } });
    expect(tables.rows!.find((r) => r.id === NEW)).toBeTruthy();
  });

  it('starts at position 1 in an empty project and makes its own id when none is given', async () => {
    const tables = sampleTables();
    tables.rows = [];
    const result = await addRow(fakeSupabase(tables).client, P1);
    expect(result).toMatchObject({ ok: true, data: { position: 1, id: expect.stringMatching(/^[0-9a-f-]{36}$/) } });
  });

  it("can't add to someone else's project", async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await addRow(client, P2)).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(tables.rows!.filter((r) => r.project_id === P2)).toHaveLength(1);
  });

  it('rejects bad ids and missing sessions; hides database errors', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await addRow(client, 'x')).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(await addRow(client, P1, { id: 'x' })).toEqual({ ok: false, error: 'Vigane viide. Laadi leht uuesti.' });
    expect(await addRow(fakeSupabase(sampleTables(), { user: null }).client, P1)).toEqual({ ok: false, error: 'Palun logi sisse.' });
    quiet();
    expect(await addRow(client, P1, { id: R(1) })).toEqual({ ok: false, error: 'Salvestamine ebaõnnestus. Palun proovi uuesti.' }); // duplicate id
    expect(await addRow(fakeSupabase(sampleTables(), { failOn: 'rows' }).client, P1)).toMatchObject({ ok: false });
    expect(await addRow(fakeSupabase(sampleTables(), { failOn: 'projects' }).client, P1)).toMatchObject({ ok: false });
  });
});

describe('updateRow (autosave)', () => {
  it('saves Estonian number input and returns the saved row', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    const result = await updateRow(client, R(1), { quantity: '12,5', unit_price: '4,20', description: '  Krohv  ' });
    expect(result).toMatchObject({ ok: true, data: { id: R(1), quantity: 12.5, unit_price: 4.2, description: 'Krohv' } });
    expect(tables.rows!.find((r) => r.id === R(1))).toMatchObject({ quantity: 12.5, unit_price: 4.2, unit: 'm²' });
  });

  it('switching calc type fills safe defaults and keeps the old values', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    // fixed (unit_price 30) -> percent: percent gets 0, unit_price stays for switching back
    expect(await updateRow(client, R(3), { calc_type: 'percent' })).toMatchObject({ ok: true, data: { calc_type: 'percent', percent: 0, unit_price: 30 } });
    // percent (percent -10) -> qty_price: quantity was 3 (kept), unit_price gets 0
    expect(await updateRow(client, R(4), { calc_type: 'qty_price' })).toMatchObject({ ok: true, data: { quantity: 3, unit_price: 0, percent: -10 } });
    // back to percent: the old -10 is still there
    expect(await updateRow(client, R(4), { calc_type: 'percent' })).toMatchObject({ ok: true, data: { percent: -10 } });
    expect(tables.rows!.find((r) => r.id === R(3))?.percent).toBe(0);
  });

  it('a new qty_price row gets quantity 1', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(3), { calc_type: 'qty_price' })).toMatchObject({ ok: true, data: { quantity: 1, unit_price: 30 } });
  });

  it('refuses to clear a field the calc type needs (same rule as the database)', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(1), { quantity: '' })).toEqual({ ok: false, error: 'Sisesta kogus.', fieldErrors: { quantity: 'Sisesta kogus.' } });
    expect(await updateRow(client, R(3), { unit_price: null })).toMatchObject({ ok: false, error: 'Sisesta ühiku hind.' });
    expect(await updateRow(client, R(4), { percent: '' })).toMatchObject({ ok: false, error: 'Sisesta protsent.' });
    expect(tables.rows!.find((r) => r.id === R(1))?.quantity).toBe(10);
    // a field the type doesn't use can be cleared
    expect(await updateRow(client, R(3), { quantity: '' })).toMatchObject({ ok: true });
  });

  it('validates numbers, dates, calc type and extra columns in Estonian', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(1), { quantity: '-1' })).toMatchObject({ fieldErrors: { quantity: 'Kogus ei saa olla negatiivne.' } });
    expect(await updateRow(client, R(1), { unit_price: '1,234' })).toMatchObject({ fieldErrors: { unit_price: 'Sisesta number, kuni 2 kohta pärast koma (nt 12,50).' } });
    expect(await updateRow(client, R(4), { percent: '-101' })).toMatchObject({ fieldErrors: { percent: 'Protsent peab olema vahemikus −100 kuni 9999,99.' } });
    expect(await updateRow(client, R(1), { date: '31.02.2026' })).toMatchObject({ fieldErrors: { date: 'Sisesta kuupäev kujul pp.kk.aaaa.' } });
    expect(await updateRow(client, R(1), { calc_type: 'formula' as never })).toMatchObject({ fieldErrors: { calc_type: 'Vali arvutuse tüüp.' } });
    expect(await updateRow(client, R(1), { description: 'x'.repeat(501) })).toMatchObject({ fieldErrors: { description: 'Kuni 500 märki.' } });
  });

  it('accepts dd.mm.yyyy and yyyy-mm-dd dates and stores yyyy-mm-dd', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(1), { date: '5.3.2026' })).toMatchObject({ ok: true, data: { date: '2026-03-05' } });
    expect(await updateRow(client, R(1), { date: '2026-12-24' })).toMatchObject({ ok: true, data: { date: '2026-12-24' } });
    expect(await updateRow(client, R(1), { date: '' })).toMatchObject({ ok: true, data: { date: null } });
  });

  it('saves extra column text', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(2), { extra: { [C1]: 'Esik' } })).toMatchObject({ ok: true, data: { extra: { [C1]: 'Esik' } } });
  });

  it('an empty patch writes nothing', async () => {
    const { client, log } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(1), {})).toMatchObject({ ok: true, data: { id: R(1) } });
    expect(log.some((q) => q.op === 'update')).toBe(false);
  });

  it("can't touch someone else's row; bad ids, sessions and errors handled", async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await updateRow(client, R(9), { description: 'Hacked' })).toEqual({ ok: false, error: 'Rida ei leitud.' });
    expect(tables.rows!.find((r) => r.id === R(9))?.description).toBe('Not yours');
    expect(await updateRow(client, 'x', {})).toEqual({ ok: false, error: 'Rida ei leitud.' });
    expect(await updateRow(fakeSupabase(sampleTables(), { user: null }).client, R(1), {})).toMatchObject({ ok: false });
    quiet();
    expect(await updateRow(fakeSupabase(sampleTables(), { failOn: 'rows' }).client, R(1), { description: 'x' })).toMatchObject({ ok: false });
  });
});

describe('duplicateRow ("Tee koopia")', () => {
  it('puts the copy directly below the original, with the same values', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    const result = await duplicateRow(client, R(2), { id: NEW });
    expect(result).toMatchObject({ ok: true, data: { id: NEW, description: 'Tööjõud', quantity: 8, unit_price: 25, position: 3 } });
    expect(order(tables)).toEqual(['Seinte krohvimine', 'Tööjõud', 'Tööjõud', 'Transport', 'Allahindlus']);
  });

  it('the copy changes the percent row below it, just like in the editor', async () => {
    const { client } = fakeSupabase(sampleTables());
    await duplicateRow(client, R(3)); // Transport 30 twice
    const data = (await getProjectForExport(client, P1))!;
    expect(calcProject(data.rows, data.project.tax_rate).lineTotals).toEqual([45, 200, 30, 30, -30.5]);
  });

  it('copies the extra column values as a separate object', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    await duplicateRow(client, R(1), { id: NEW });
    const copy = tables.rows!.find((r) => r.id === NEW)!;
    expect(copy.extra).toMatchObject({ [C1]: 'Köök' });
  });

  it('removes the copy again if the reorder fails', async () => {
    quiet();
    const { client, tables } = fakeSupabase(sampleTables(), { failOn: 'reorder_rows' });
    expect(await duplicateRow(client, R(2), { id: NEW })).toMatchObject({ ok: false, error: 'Salvestamine ebaõnnestus. Palun proovi uuesti.' });
    expect(tables.rows!.some((r) => r.id === NEW)).toBe(false);
  });

  it("can't copy someone else's row; bad ids, sessions and errors handled", async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await duplicateRow(client, R(9))).toEqual({ ok: false, error: 'Rida ei leitud.' });
    expect(await duplicateRow(client, 'x')).toEqual({ ok: false, error: 'Rida ei leitud.' });
    expect(await duplicateRow(client, R(1), { id: 'x' })).toEqual({ ok: false, error: 'Vigane viide. Laadi leht uuesti.' });
    expect(await duplicateRow(fakeSupabase(sampleTables(), { user: null }).client, R(1))).toMatchObject({ ok: false });
    quiet();
    expect(await duplicateRow(fakeSupabase(sampleTables(), { failOn: 'rows' }).client, R(1))).toMatchObject({ ok: false });
  });
});

describe('deleteRow ("Kustuta")', () => {
  it('deletes the row and returns its project', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await deleteRow(client, R(3))).toEqual({ ok: true, data: { project_id: P1 } });
    expect(order(tables)).toEqual(['Seinte krohvimine', 'Tööjõud', 'Allahindlus']);
  });

  it("can't delete someone else's row; bad ids, sessions and errors handled", async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await deleteRow(client, R(9))).toEqual({ ok: false, error: 'Rida ei leitud.' });
    expect(tables.rows!.some((r) => r.id === R(9))).toBe(true);
    expect(await deleteRow(client, 'x')).toEqual({ ok: false, error: 'Rida ei leitud.' });
    expect(await deleteRow(fakeSupabase(sampleTables(), { user: null }).client, R(1))).toMatchObject({ ok: false });
    quiet();
    expect(await deleteRow(fakeSupabase(sampleTables(), { failOn: 'rows' }).client, R(1))).toMatchObject({ ok: false });
  });
});

describe('reorderRows ("Liiguta üles/alla")', () => {
  it('saves the full new order through the reorder_rows RPC', async () => {
    const { client, tables, log } = fakeSupabase(sampleTables());
    expect(await reorderRows(client, P1, [R(1), R(3), R(2), R(4)])).toEqual({ ok: true, data: null });
    expect(order(tables)).toEqual(['Seinte krohvimine', 'Transport', 'Tööjõud', 'Allahindlus']);
    expect(log.find((q) => q.op === 'rpc')).toMatchObject({ table: 'reorder_rows', payload: { p_project_id: P1, p_row_ids: [R(1), R(3), R(2), R(4)] } });
  });

  it('asks to reload when the order no longer matches the rows', async () => {
    const { client } = fakeSupabase(sampleTables());
    const reload = 'Ridade järjekord on vahepeal muutunud. Laadi leht uuesti.';
    expect(await reorderRows(client, P1, [R(1), R(2)])).toEqual({ ok: false, error: reload }); // missing rows
    expect(await reorderRows(client, P1, [R(1), R(1), R(2), R(3)])).toEqual({ ok: false, error: reload }); // duplicate
    expect(await reorderRows(client, P1, ['x'])).toEqual({ ok: false, error: reload });
  });

  it("can't reorder someone else's project; bad ids, sessions and errors handled", async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await reorderRows(client, P2, [R(9)])).toMatchObject({ ok: false });
    expect(await reorderRows(client, 'x', [])).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(await reorderRows(fakeSupabase(sampleTables(), { user: null }).client, P1, [])).toMatchObject({ ok: false });
    quiet();
    expect(await reorderRows(fakeSupabase(sampleTables(), { failOn: 'reorder_rows' }).client, P1, [R(1), R(2), R(3), R(4)])).toEqual({
      ok: false,
      error: 'Salvestamine ebaõnnestus. Palun proovi uuesti.',
    });
  });
});
