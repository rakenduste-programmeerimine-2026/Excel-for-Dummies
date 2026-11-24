-- Row Level Security. ON for every table, policies only for `authenticated`.
-- Anonymous users see nothing. `(select auth.uid())` is evaluated once per
-- query instead of once per row (Supabase performance recommendation).

alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_columns enable row level security;
alter table public.rows            enable row level security;

-- profiles: read + update own row only. No insert/delete from the client;
-- the trigger creates the row and auth.users deletion cascades.
create policy "own profile select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "own profile update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projects
create policy "own projects" on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- child tables: the parent project must belong to the user
create policy "own project columns" on public.project_columns
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_columns.project_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_columns.project_id and p.user_id = (select auth.uid())
  ));

create policy "own project rows" on public.rows
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = rows.project_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = rows.project_id and p.user_id = (select auth.uid())
  ));
