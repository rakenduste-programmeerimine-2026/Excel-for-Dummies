-- Local demo data. Runs after the migrations on `npx supabase db reset`.
-- NEVER run this against production.
--
-- Two demo accounts (two so QA can test RLS: A must not see B's projects):
--   demo@example.com  / parool123   "Demo Ehitus OÜ", one full project
--   demo2@example.com / parool123   "Teine Firma OÜ", one small project

-- ---------------------------------------------------------------------------
-- Users (the on_auth_user_created trigger creates their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'demo@example.com',
   extensions.crypt('parool123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'demo2@example.com',
   extensions.crypt('parool123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'email',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@example.com","email_verified":true}',
   now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'email',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"demo2@example.com","email_verified":true}',
   now(), now(), now());

-- ---------------------------------------------------------------------------
-- Profiles (rows already exist thanks to the trigger)
-- ---------------------------------------------------------------------------
update public.profiles set business_name = 'Demo Ehitus OÜ'
where id = '11111111-1111-1111-1111-111111111111';

update public.profiles set business_name = 'Teine Firma OÜ', default_tax_rate = 22.00
where id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------------------
-- User A: the example project from docs/database.md
-- Expected: subtotal 247.50, käibemaks 24% = 59.40, total 306.90
-- ---------------------------------------------------------------------------
insert into public.projects (id, user_id, name, client, address, tax_rate) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Õie tänav 5', 'Mari Maasikas', 'Õie tänav 5, Tartu', 24.00);

insert into public.project_columns (id, project_id, name, position) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ruum', 1);

insert into public.rows
  (project_id, position, date, description, calc_type, quantity, unit, unit_price, percent, extra)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, '2026-11-02', 'Seinte krohvimine', 'qty_price', 10.000, 'm²', 4.50, null,
   '{"cccccccc-0000-0000-0000-000000000001": "Elutuba"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 2, '2026-11-03', 'Tööjõud', 'qty_price', 8.000, 'h', 25.00, null,
   '{"cccccccc-0000-0000-0000-000000000001": "Elutuba"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 3, '2026-11-03', 'Transport', 'fixed', null, null, 30.00, null,
   '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 4, null, 'Allahindlus', 'percent', null, null, null, -10.00,
   '{}');

-- An empty project, to check that an empty table still exports
insert into public.projects (id, user_id, name, client, address, tax_rate) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Tühi projekt', null, null, 24.00);

-- ---------------------------------------------------------------------------
-- User B: a small project user A must NOT be able to see
-- ---------------------------------------------------------------------------
insert into public.projects (id, user_id, name, client, address, tax_rate) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Pargi 12 vannituba', 'Jaan Tamm', 'Pargi 12, Tallinn', 22.00);

insert into public.rows
  (project_id, position, description, calc_type, quantity, unit, unit_price, percent)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 1, 'Plaatimine', 'qty_price', 6.500, 'm²', 32.00, null),
  ('bbbbbbbb-0000-0000-0000-000000000001', 2, 'Juurdehindlus', 'percent', null, null, null, 15.00);
