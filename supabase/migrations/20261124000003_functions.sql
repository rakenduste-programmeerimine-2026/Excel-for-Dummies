-- Trigger: create the profile row when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- RPC: rewrite row order for one project in a single transaction.
-- p_row_ids is the FULL new order; p_row_ids[i] gets position = i.
-- Raises unless the array is exactly the project's row ids (no missing,
-- extra, duplicate or null ids). Security invoker, so RLS applies: rows of
-- another user's project are invisible and the call fails.
-- Also used for "duplicate": insert the copy at the end, then reorder.
create function public.reorder_rows(p_project_id uuid, p_row_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_len      int := coalesce(array_length(p_row_ids, 1), 0);
  v_total    int;
  v_matching int;
begin
  -- lock the project's rows so concurrent reorders/inserts can't interleave
  perform 1 from public.rows where project_id = p_project_id for update;

  select count(*) into v_total
  from public.rows
  where project_id = p_project_id;

  select count(distinct t.id) into v_matching
  from unnest(p_row_ids) as t(id)
  join public.rows r on r.id = t.id and r.project_id = p_project_id;

  if v_total <> v_len or v_matching <> v_len then
    raise exception 'reorder_rows: p_row_ids must contain exactly the rows of project %', p_project_id
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  update public.rows r
  set position = t.ord
  from unnest(p_row_ids) with ordinality as t(id, ord)
  where r.id = t.id
    and r.project_id = p_project_id;
end
$$;


-- RPC: delete an extra column and remove its key from every row's `extra`.
create function public.delete_column(p_column_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.project_columns
  where id = p_column_id
  for update;

  if not found then
    raise exception 'delete_column: column % not found', p_column_id
      using errcode = 'P0002';  -- no_data_found
  end if;

  update public.rows
  set extra = extra - p_column_id::text
  where project_id = v_project_id
    and extra ? p_column_id::text;

  delete from public.project_columns where id = p_column_id;
end
$$;

-- Only signed-in users may call the RPCs.
revoke execute on function public.reorder_rows(uuid, uuid[]) from public, anon;
revoke execute on function public.delete_column(uuid)        from public, anon;
grant  execute on function public.reorder_rows(uuid, uuid[]) to authenticated;
grant  execute on function public.delete_column(uuid)        to authenticated;
