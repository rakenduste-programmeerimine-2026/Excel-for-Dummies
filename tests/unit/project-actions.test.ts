import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProject, deleteProject, updateProfile, updateProject } from '@/lib/actions/projects';
import { fakeSupabase, P1, P2, sampleTables } from './fake-supabase';

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('createProject', () => {
  it('copies the tax rate from the profile default', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    const result = await createProject(client, { name: 'Vannituba', client: 'Jaan', address: '' });
    expect(result.ok).toBe(true);
    const created = tables.projects!.find((p) => p.name === 'Vannituba');
    expect(created).toMatchObject({ user_id: 'user-1', client: 'Jaan', address: null, tax_rate: 24 });
    expect(result).toEqual({ ok: true, data: { id: created!.id } });
  });

  it('uses the CURRENT default, and changing it later never touches existing projects', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    await updateProfile(client, { default_tax_rate: '22' });
    await createProject(client, { name: 'Uus' });
    expect(tables.projects!.find((p) => p.name === 'Uus')?.tax_rate).toBe(22);
    expect(tables.projects!.find((p) => p.id === P1)?.tax_rate).toBe(24);
  });

  it('returns Estonian field errors', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await createProject(client, { name: ' ' })).toEqual({
      ok: false,
      error: 'Sisesta projekti nimi.',
      fieldErrors: { name: 'Sisesta projekti nimi.' },
    });
  });

  it('needs a signed-in user and a profile', async () => {
    expect(await createProject(fakeSupabase(sampleTables(), { user: null }).client, { name: 'X' })).toEqual({ ok: false, error: 'Palun logi sisse.' });
    const tables = sampleTables();
    tables.profiles = [];
    expect(await createProject(fakeSupabase(tables).client, { name: 'X' })).toMatchObject({ ok: false, error: expect.stringContaining('profiili') });
  });

  it('hides database errors behind a friendly message', async () => {
    const spy = quiet();
    for (const table of ['profiles', 'projects']) {
      const result = await createProject(fakeSupabase(sampleTables(), { failOn: table }).client, { name: 'X' });
      expect(result).toEqual({ ok: false, error: 'Salvestamine ebaõnnestus. Palun proovi uuesti.' });
    }
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('updateProject', () => {
  it('changes only the given fields', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await updateProject(client, P1, { name: 'Köök ja esik', tax_rate: '22,5' })).toEqual({ ok: true, data: null });
    expect(tables.projects!.find((p) => p.id === P1)).toMatchObject({ name: 'Köök ja esik', tax_rate: 22.5, client: 'Mari Maasikas' });
  });

  it('does nothing when nothing changed', async () => {
    const { client, log } = fakeSupabase(sampleTables());
    expect(await updateProject(client, P1, {})).toEqual({ ok: true, data: null });
    expect(log.some((q) => q.op === 'update')).toBe(false);
  });

  it("can't change someone else's project", async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await updateProject(client, P2, { name: 'Hacked' })).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(tables.projects!.find((p) => p.id === P2)?.name).toBe('Someone else');
  });

  it('validates the id, the input and the session', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await updateProject(client, 'nope', { name: 'X' })).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(await updateProject(client, P1, { tax_rate: '101' })).toMatchObject({ ok: false, fieldErrors: { tax_rate: expect.any(String) } });
    expect(await updateProject(fakeSupabase(sampleTables(), { user: null }).client, P1, { name: 'X' })).toMatchObject({ ok: false });
  });

  it('hides database errors', async () => {
    quiet();
    expect(await updateProject(fakeSupabase(sampleTables(), { failOn: 'projects' }).client, P1, { name: 'X' })).toMatchObject({
      ok: false,
      error: 'Salvestamine ebaõnnestus. Palun proovi uuesti.',
    });
  });
});

describe('deleteProject', () => {
  it('deletes the project with its rows and columns', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await deleteProject(client, P1)).toEqual({ ok: true, data: null });
    expect(tables.projects!.map((p) => p.id)).toEqual([P2]);
    expect(tables.rows!.every((r) => r.project_id !== P1)).toBe(true);
    expect(tables.project_columns).toEqual([]);
  });

  it("can't delete someone else's project, or a malformed id", async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await deleteProject(client, P2)).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(await deleteProject(client, 'x')).toEqual({ ok: false, error: 'Projekti ei leitud.' });
    expect(tables.projects).toHaveLength(2);
    expect(await deleteProject(fakeSupabase(sampleTables(), { user: null }).client, P1)).toMatchObject({ ok: false });
  });

  it('hides database errors', async () => {
    quiet();
    expect(await deleteProject(fakeSupabase(sampleTables(), { failOn: 'projects' }).client, P1)).toMatchObject({ ok: false });
  });
});

describe('updateProfile', () => {
  it('updates the business name and default tax rate of the signed-in user only', async () => {
    const { client, tables } = fakeSupabase(sampleTables());
    expect(await updateProfile(client, { business_name: 'Uus Nimi OÜ', default_tax_rate: '24' })).toEqual({ ok: true, data: null });
    expect(tables.profiles).toEqual([
      { id: 'user-1', business_name: 'Uus Nimi OÜ', default_tax_rate: 24 },
      { id: 'user-2', business_name: 'Other OÜ', default_tax_rate: 22 },
    ]);
  });

  it('validates input and handles missing profile, session and errors', async () => {
    const { client } = fakeSupabase(sampleTables());
    expect(await updateProfile(client, { default_tax_rate: 'abc' })).toMatchObject({ ok: false });
    expect(await updateProfile(client, {})).toEqual({ ok: true, data: null });
    const tables = sampleTables();
    tables.profiles = [];
    expect(await updateProfile(fakeSupabase(tables).client, { business_name: 'X' })).toMatchObject({ ok: false, error: expect.stringContaining('profiili') });
    expect(await updateProfile(fakeSupabase(sampleTables(), { user: null }).client, { business_name: 'X' })).toMatchObject({ ok: false });
    quiet();
    expect(await updateProfile(fakeSupabase(sampleTables(), { failOn: 'profiles' }).client, { business_name: 'X' })).toMatchObject({ ok: false });
  });
});
