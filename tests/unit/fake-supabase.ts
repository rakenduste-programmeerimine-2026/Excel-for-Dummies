// A small in-memory stand-in for the parts of supabase-js the backend uses
// (select / insert / update / delete with eq, order, limit, single, maybeSingle; rpc; auth.getUser).
// It mimics Row Level Security: a user only sees their own projects, profile, and the rows
// and columns of their own projects. Every query is logged so tests can check filters.
import { randomUUID } from 'node:crypto';
import type { Supabase } from '@/lib/queries';

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
type Err = { message: string; code?: string } | null;
type Result = { data: unknown; error: Err };

export type FakeOptions = {
  user?: { id: string } | null;
  failOn?: string; // table (or rpc name) whose call returns an error
};

export type LogEntry = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  filters: [string, unknown][];
  orders: string[];
  payload?: unknown;
};

export function fakeSupabase(tables: Tables, options: FakeOptions = {}) {
  const log: LogEntry[] = [];
  const user = options.user === undefined ? { id: 'user-1' } : options.user;
  let clock = 1000;

  const ownsProject = (projectId: unknown) => (tables.projects ?? []).some((p) => p.id === projectId && p.user_id === user?.id);
  const visible = (table: string, row: Row): boolean => {
    if (!user) return false;
    if (table === 'projects') return row.user_id === user.id;
    if (table === 'profiles') return row.id === user.id;
    if (table === 'rows' || table === 'project_columns') return ownsProject(row.project_id);
    return true;
  };
  const rlsError: Err = { message: 'new row violates row-level security policy', code: '42501' };

  function from(table: string) {
    const entry: LogEntry = { table, op: 'select', filters: [], orders: [] };
    log.push(entry);
    const desc = new Set<string>();
    let limit: number | undefined;
    let returning = false;
    let columns: string[] = [];
    /** Like PostgREST: exactly the selected columns, null when unset. */
    const withColumns = (rows: Row[]): Row[] =>
      columns.length ? rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))) : rows;

    const matching = (): Row[] => {
      let rows = (tables[table] ?? []).filter((r) => visible(table, r));
      for (const [col, value] of entry.filters) rows = rows.filter((r) => r[col] === value);
      return rows;
    };
    const sorted = (rows: Row[]): Row[] => {
      const copy = [...rows];
      for (const col of [...entry.orders].reverse()) {
        const dir = desc.has(col) ? -1 : 1;
        copy.sort((a, b) => {
          const x = a[col] as number | string;
          const y = b[col] as number | string;
          return (x < y ? -1 : x > y ? 1 : 0) * dir;
        });
      }
      return limit === undefined ? copy : copy.slice(0, limit);
    };

    const execute = (): Result => {
      if (options.failOn === table) return { data: null, error: { message: `${table} exploded` } };
      tables[table] ??= [];
      const store = tables[table];
      switch (entry.op) {
        case 'select':
          return { data: withColumns(sorted(matching())), error: null };
        case 'insert': {
          const items = (Array.isArray(entry.payload) ? entry.payload : [entry.payload]) as Row[];
          const created: Row[] = items.map((item) => ({ id: randomUUID(), created_at: String(clock++), ...item }));
          if (!created.every((r) => visible(table, r) || (table === 'projects' && r.user_id === user?.id))) return { data: null, error: rlsError };
          if (created.some((r) => store.some((s) => s.id === r.id))) return { data: null, error: { message: 'duplicate key', code: '23505' } };
          store.push(...created);
          return { data: returning ? withColumns(created) : null, error: null };
        }
        case 'update': {
          const rows = matching();
          const patch = entry.payload as Row;
          if (table === 'projects' && 'user_id' in patch && patch.user_id !== user?.id) return { data: null, error: rlsError };
          for (const r of rows) Object.assign(r, patch);
          return { data: returning ? withColumns(rows) : null, error: null };
        }
        case 'delete': {
          const rows = matching();
          tables[table] = store.filter((r) => !rows.includes(r));
          if (table === 'projects') {
            const ids = new Set(rows.map((r) => r.id));
            for (const child of ['rows', 'project_columns']) tables[child] = (tables[child] ?? []).filter((r) => !ids.has(r.project_id));
          }
          return { data: returning ? rows : null, error: null };
        }
        default:
          throw new Error(`unsupported op ${entry.op}`);
      }
    };

    const one = (required: boolean): Result => {
      const result = execute();
      if (result.error) return result;
      const list = (result.data as Row[] | null) ?? [];
      if (required && list.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      return { data: list[0] ?? null, error: null };
    };

    const builder = {
      select: (cols?: string) => {
        if (entry.op !== 'select') returning = true;
        columns = cols && cols !== '*' ? cols.split(',').map((c) => c.trim()) : [];
        return builder;
      },
      insert: (payload: unknown) => ((entry.op = 'insert'), (entry.payload = payload), builder),
      update: (payload: unknown) => ((entry.op = 'update'), (entry.payload = payload), builder),
      delete: () => ((entry.op = 'delete'), builder),
      eq: (col: string, value: unknown) => (entry.filters.push([col, value]), builder),
      order: (col: string, opts?: { ascending?: boolean }) => {
        entry.orders.push(col);
        if (opts?.ascending === false) desc.add(col);
        return builder;
      },
      limit: (n: number) => ((limit = n), builder),
      single: () => Promise.resolve(one(true)),
      maybeSingle: () => Promise.resolve(one(false)),
      then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    };
    return builder;
  }

  function rpc(name: string, args: Record<string, unknown>): Promise<Result> {
    log.push({ table: name, op: 'rpc', filters: [], orders: [], payload: args });
    if (options.failOn === name) return Promise.resolve({ data: null, error: { message: `${name} exploded` } });
    if (name === 'reorder_rows') {
      const projectId = args.p_project_id;
      const ids = args.p_row_ids as string[];
      const rows = (tables.rows ?? []).filter((r) => r.project_id === projectId && visible('rows', r));
      const same = ids.length === rows.length && new Set(ids).size === ids.length && rows.every((r) => ids.includes(r.id as string));
      // Same errcode as the real function (supabase/migrations/*_functions.sql).
      if (!same) return Promise.resolve({ data: null, error: { message: 'reorder_rows: p_row_ids must contain exactly the rows of project', code: '22023' } });
      ids.forEach((id, i) => (rows.find((r) => r.id === id)!.position = i + 1));
      return Promise.resolve({ data: null, error: null });
    }
    if (name === 'delete_column') {
      const column = (tables.project_columns ?? []).find((c) => c.id === args.p_column_id && visible('project_columns', c));
      // Same errcode as the real function (supabase/migrations/*_functions.sql).
      if (!column) return Promise.resolve({ data: null, error: { message: 'delete_column: column not found', code: 'P0002' } });
      {
        for (const r of tables.rows ?? []) {
          if (r.project_id === column.project_id && r.extra && typeof r.extra === 'object') delete (r.extra as Row)[column.id as string];
        }
        tables.project_columns = (tables.project_columns ?? []).filter((c) => c !== column);
      }
      return Promise.resolve({ data: null, error: null });
    }
    throw new Error(`unknown rpc ${name}`);
  }

  const client = {
    from,
    rpc,
    auth: { getUser: () => Promise.resolve({ data: { user }, error: user ? null : { message: 'Auth session missing!' } }) },
  };
  return { client: client as unknown as Supabase, log, tables };
}

export const P1 = '11111111-1111-4111-8111-111111111111';
export const P2 = '22222222-2222-4222-8222-222222222222';
export const R = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
export const C1 = 'cccccccc-cccc-4ccc-8ccc-000000000001';
export const C2 = 'cccccccc-cccc-4ccc-8ccc-000000000002';

/** user-1 owns P1 (two extra columns, rows stored out of order); user-2 owns P2. */
export function sampleTables(): Tables {
  return {
    projects: [
      { id: P1, user_id: 'user-1', name: 'Õie tänav 5', client: 'Mari Maasikas', address: 'Õie tänav 5, Tallinn', tax_rate: 24 },
      { id: P2, user_id: 'user-2', name: 'Someone else', client: null, address: null, tax_rate: 22 },
    ],
    profiles: [
      { id: 'user-1', business_name: 'Kodu Remont OÜ', default_tax_rate: 24 },
      { id: 'user-2', business_name: 'Other OÜ', default_tax_rate: 22 },
    ],
    project_columns: [
      { id: C2, project_id: P1, name: 'Tarnija', position: 2 },
      { id: C1, project_id: P1, name: 'Ruum', position: 1 },
    ],
    rows: [
      { id: R(3), project_id: P1, position: 3, created_at: '1', date: null, description: 'Transport', calc_type: 'fixed', quantity: null, unit: null, unit_price: '30.00', percent: null, extra: {} },
      { id: R(1), project_id: P1, position: 1, created_at: '1', date: '2026-11-02', description: 'Seinte krohvimine', calc_type: 'qty_price', quantity: 10, unit: 'm²', unit_price: 4.5, percent: null, extra: { [C1]: 'Köök', gone: 'x', n: 5, bad: { a: 1 } } },
      { id: R(4), project_id: P1, position: 4, created_at: '1', date: null, description: 'Allahindlus', calc_type: 'percent', quantity: 3, unit: null, unit_price: null, percent: -10, extra: [] },
      { id: R(2), project_id: P1, position: 2, created_at: '1', date: null, description: 'Tööjõud', calc_type: 'qty_price', quantity: '8.000', unit: 'h', unit_price: 25, percent: null, extra: null },
      { id: R(9), project_id: P2, position: 1, created_at: '1', date: null, description: 'Not yours', calc_type: 'fixed', quantity: null, unit: null, unit_price: 1, percent: null, extra: {} },
    ],
  };
}
