import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportProject, XLSX_CONTENT_TYPE } from '@/lib/exportProject';
import { fakeSupabase, P1, P2, sampleTables } from './fake-supabase';

const now = new Date('2026-11-19T10:00:00Z');

afterEach(() => vi.restoreAllMocks());

describe('GET /api/projects/[id]/export', () => {
  it('returns the .xlsx with the contract file name', async () => {
    const res = await exportProject(fakeSupabase(sampleTables()).client, P1, now);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(XLSX_CONTENT_TYPE);
    expect(res.headers.get('Content-Disposition')).toBe(
      `attachment; filename="Oie tanav 5-2026-11-19.xlsx"; filename*=UTF-8''%C3%95ie%20t%C3%A4nav%205-2026-11-19.xlsx`,
    );
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');

    const body = new Uint8Array(await res.arrayBuffer());
    expect(res.headers.get('Content-Length')).toBe(String(body.length));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(body.buffer as ArrayBuffer);
    const sheet = wb.worksheets[0]!;
    expect(sheet.name).toBe('Õie tänav 5');
    expect(sheet.getCell('A1').value).toBe('Kodu Remont OÜ');
    // two extra columns -> Summa in column I; docs/database.md totals
    expect(sheet.getCell('I10').formula).toBe('SUM(I5:I8)');
    expect([10, 12, 13].map((r) => sheet.getCell(`I${r}`).result)).toEqual([247.5, 59.4, 306.9]);
  });

  it('401 in Estonian when nobody is signed in', async () => {
    const res = await exportProject(fakeSupabase(sampleTables(), { user: null }).client, P1, now);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Palun logi sisse.' });
  });

  it('404 when the project does not exist, belongs to someone else, or the id is not a uuid', async () => {
    for (const id of ['33333333-3333-4333-8333-333333333333', P2, 'not-a-uuid', '1; drop table rows']) {
      const res = await exportProject(fakeSupabase(sampleTables()).client, id, now);
      expect(res.status, id).toBe(404);
      expect(await res.json()).toEqual({ error: 'Projekti ei leitud.' });
    }
  });

  it('exports a project with zero rows', async () => {
    const tables = sampleTables();
    tables.rows = [];
    const res = await exportProject(fakeSupabase(tables).client, P1, now);
    expect(res.status).toBe(200);
  });

  it('500 in Estonian when loading fails, without leaking the database error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await exportProject(fakeSupabase(sampleTables(), { failOn: 'rows' }).client, P1, now);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Exceli faili loomine ebaõnnestus. Palun proovi uuesti.' });
    expect(JSON.stringify(body)).not.toContain('exploded');
    expect(spy).toHaveBeenCalledOnce();
  });
});
