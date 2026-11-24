-- Excel for Dummies: core schema.
-- Contract: CLAUDE.md "Database schema". Reference: docs/database.md.
-- Line totals, subtotal, tax and total are NEVER stored. lib/calc.ts computes them.

create type public.calc_type as enum ('fixed', 'qty_price', 'percent');

-- One row per user, created by the on_auth_user_created trigger.
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  business_name    text,
  default_tax_rate numeric(5,2) not null default 24.00  -- percent; copied into NEW projects only
);

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  client     text,
  address    text,
  tax_rate   numeric(5,2) not null,  -- percent, copied from profiles.default_tax_rate at creation
  created_at timestamptz default now()
);

create index projects_user_id_idx on public.projects (user_id);

-- The user's own extra columns. Text only, never used in calculations.
create table public.project_columns (
  id         uuid primary key default gen_random_uuid(),  -- also the key in rows.extra
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null,
  position   int  not null
);

create index project_columns_project_position_idx on public.project_columns (project_id, position);

create table public.rows (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  position    int  not null,                          -- display + calculation order
  date        date,
  description text not null,
  calc_type   public.calc_type not null default 'fixed',
  quantity    numeric(12,3),                          -- qty_price only
  unit        text,                                   -- e.g. 'm²', 'h', 'tk'
  unit_price  numeric(12,2),                          -- fixed + qty_price
  percent     numeric(6,2),                           -- percent only, negative = discount
  extra       jsonb not null default '{}'::jsonb,     -- { "<project_column_id>": "text value" }
  created_at  timestamptz default now(),

  -- Each calc type must have the fields it uses. Unused fields may keep old
  -- values so switching the type back restores what the user typed.
  constraint rows_required_fields check (
    case calc_type
      when 'fixed'     then unit_price is not null
      when 'qty_price' then quantity is not null and unit_price is not null
      when 'percent'   then percent is not null
    end
  )
);

create index rows_project_position_idx on public.rows (project_id, position);
