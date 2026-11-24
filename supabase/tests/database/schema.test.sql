-- Database tests. Run with: npx supabase test db
-- Uses the seed data (two users, see supabase/seed.sql). Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Trigger --------------------------------------------------------------------
select is(
  (select default_tax_rate from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  24.00::numeric,
  'signup trigger created a profile with the default tax rate'
);

-- Check constraint -------------------------------------------------------------
select throws_ok(
  $$ insert into public.rows (project_id, position, description, calc_type, quantity)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 99, 'x', 'qty_price', 1) $$,
  '23514', null, 'qty_price without unit_price is rejected'
);
select throws_ok(
  $$ insert into public.rows (project_id, position, description, calc_type)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 99, 'x', 'percent') $$,
  '23514', null, 'percent without percent is rejected'
);
select lives_ok(
  $$ update public.rows set calc_type = 'fixed'
     where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and position = 1 $$,
  'switching qty_price -> fixed keeps old quantity and is allowed'
);

-- RLS as user A -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.projects), 2, 'A sees only own projects');
select is((select count(*)::int from public.rows
           where project_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0, 'A cannot see B''s rows');
select is((select count(*)::int from public.profiles), 1, 'A sees only own profile');

select throws_ok(
  $$ insert into public.rows (project_id, position, description, unit_price)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 9, 'hack', 1) $$,
  '42501', null, 'A cannot insert rows into B''s project'
);

update public.projects set name = 'hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- reorder_rows -------------------------------------------------------------------
select lives_ok(
  $$ select public.reorder_rows(
       'aaaaaaaa-0000-0000-0000-000000000001',
       array(select id from public.rows
             where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
             order by position desc)) $$,
  'reorder_rows accepts the full list'
);
select is(
  (select description from public.rows
   where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and position = 1),
  'Allahindlus', 'reorder_rows reversed the order'
);
select throws_ok(
  $$ select public.reorder_rows(
       'aaaaaaaa-0000-0000-0000-000000000001',
       array(select id from public.rows
             where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 2)) $$,
  '22023', null, 'reorder_rows rejects an incomplete list'
);
select throws_ok(
  $$ select public.reorder_rows('bbbbbbbb-0000-0000-0000-000000000001',
       array['bbbbbbbb-0000-0000-0000-000000000001'::uuid]) $$,
  '22023', null, 'reorder_rows cannot touch B''s project'
);

-- delete_column -------------------------------------------------------------------
select public.delete_column('cccccccc-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.rows
   where extra ? 'cccccccc-0000-0000-0000-000000000001'),
  0, 'delete_column removed the key from rows.extra'
);

reset role;
select is(
  (select name from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'Pargi 12 vannituba', 'A''s update on B''s project changed nothing'
);

select * from finish();
rollback;
