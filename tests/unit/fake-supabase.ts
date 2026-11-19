// A tiny in-memory stand-in for the parts of the Supabase query builder the backend uses.
// It records each query so tests can check filters and ordering.
import type { Supabase } from '@/lib/queries';

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
type Result = { data: unknown; error: { message: string } | null };

export type FakeOptions = {
  user?: { id: string } | null;
  /** Simulates RLS: only projects of this user are visible. Defaults to the signed-in user. */
  visibleTo?: string;
  failOn?: string; // table name whose query returns an error
};

export function fakeSupabase(tables: Tables, options: FakeOptions = {}) {
  const log: { table: string; filters: [string, unknown][]; orders: string[] }[] = [];
  const user = options.user === undefined ? { id: 'user-1' } : options.user;
  const visibleTo = options.visibleTo ?? user?.id;

  function from(table: string) {
    const entry = { table, filters: [] as [string, unknown][], orders: [] as string[] };
    log.push(entry);
    const run = (): Row[] => {
      let rows = [...(tables[table] ?? [])];
      if (table === 'projects') rows = rows.filter((r) => r.user_id === visibleTo); // RLS
      for (const [col, value] of entry.filters) rows = rows.filter((r) => r[col] === value);
      for (const col of [...entry.orders].reverse()) {
        rows.sort((a, b) => (a[col] as number) - (b[col] as number) || String(a[col]).localeCompare(String(b[col])));
      }
      return rows;
    };
    const result = (single: boolean): Result =>
      options.failOn === table ? { data: null, error: { message: `${table} exploded` } } : { data: single ? (run()[0] ?? null) : run(), error: null };
    const builder = {
      select: () => builder,
      eq: (col: string, value: unknown) => (entry.filters.push([col, value]), builder),
      order: (col: string) => (entry.orders.push(col), builder),
      maybeSingle: () => Promise.resolve(result(true)),
      then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result(false)).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from,
    auth: { getUser: () => Promise.resolve({ data: { user }, error: user ? null : { message: 'Auth session missing!' } }) },
  };
  return { client: client as unknown as Supabase, log };
}

export const P1 = '11111111-1111-4111-8111-111111111111';
export const P2 = '22222222-2222-4222-8222-222222222222';

/** A project of user-1 with two extra columns and rows stored out of order. */
export function sampleTables(): Tables {
  return {
    projects: [
      { id: P1, user_id: 'user-1', name: 'Õie tänav 5', client: 'Mari Maasikas', address: 'Õie tänav 5, Tallinn', tax_rate: 24 },
      { id: P2, user_id: 'user-2', name: 'Someone else', client: null, address: null, tax_rate: 22 },
    ],
    profiles: [{ id: 'user-1', business_name: 'Kodu Remont OÜ', default_tax_rate: 24 }],
    project_columns: [
      { id: 'c2', project_id: P1, name: 'Tarnija', position: 2 },
      { id: 'c1', project_id: P1, name: 'Ruum', position: 1 },
    ],
    rows: [
      { project_id: P1, position: 3, created_at: '1', date: null, description: 'Transport', calc_type: 'fixed', quantity: null, unit: null, unit_price: '30.00', percent: null, extra: {} },
      { project_id: P1, position: 1, created_at: '1', date: '2026-11-02', description: 'Seinte krohvimine', calc_type: 'qty_price', quantity: 10, unit: 'm²', unit_price: 4.5, percent: null, extra: { c1: 'Köök', gone: 'x', n: 5, bad: { a: 1 } } },
      { project_id: P1, position: 4, created_at: '1', date: null, description: 'Allahindlus', calc_type: 'percent', quantity: 3, unit: null, unit_price: null, percent: -10, extra: [] },
      { project_id: P1, position: 2, created_at: '1', date: null, description: 'Tööjõud', calc_type: 'qty_price', quantity: '8.000', unit: 'h', unit_price: 25, percent: null, extra: null },
    ],
  };
}
