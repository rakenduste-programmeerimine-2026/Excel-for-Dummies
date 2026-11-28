# Excel for Dummies

A web app for small business owners who know almost nothing about Excel. The user creates a **project** (a client or an address), builds its table of rows, and downloads a formatted **.xlsx** file to send to the client. Every calculation in that file is a real Excel formula.

The app is fully in Estonian. Code, comments and docs are in English.

**Core features**

1. **Projects and a flexible table.** Add, edit, reorder, duplicate and delete rows; add extra text columns.
2. **Calculations.** Each row is a fixed amount, quantity × unit price, or a percentage of the rows above it. The project gets a subtotal, käibemaks (VAT) and a total.
3. **Excel export.** A clean .xlsx file where every total is a working formula.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript strict)
- [Supabase](https://supabase.com/): Postgres, Auth (email + password), Row Level Security
- [exceljs](https://github.com/exceljs/exceljs) for the .xlsx file (server only)
- [zod](https://zod.dev/) for validation
- [Vitest](https://vitest.dev/) for tests
- Deployed on Vercel

## Run it locally

### Prerequisites

- Node.js 22 (the version CI uses)
- Docker (Supabase runs locally in containers)

### Setup

```sh
# 1. Install dependencies
npm ci

# 2. Start local Supabase (first run downloads the Docker images)
npx supabase start

# 3. Create your env file and paste the anon key from `npx supabase status`
cp .env.example .env.local

# 4. Run the migrations and load the demo data
npx supabase db reset

# 5. Start the app
npm run dev
```

Open <http://localhost:3000> and log in with a seed user:

| Email | Password | Business name |
|---|---|---|
| `demo@example.com` | `parool123` | Demo Ehitus OÜ |
| `demo2@example.com` | `parool123` | Teine Firma OÜ |

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `http://127.0.0.1:54321` locally |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | from `npx supabase status` |
| `NEXT_PUBLIC_SITE_URL` | no | public address of the app, used in the confirmation email link; defaults to the request's own origin |

The service-role key is never used by the app.

### Local tools

| URL | What |
|---|---|
| <http://localhost:3000> | the app |
| <http://127.0.0.1:54323> | Supabase Studio (browse tables, users) |
| <http://127.0.0.1:54324> | Mailpit: emails sent locally (sign-up confirmations) land here |

Local Supabase uses fixed ports, so only one local Supabase project can run at a time. Stop the other one with `npx supabase stop` in its folder.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | local dev server |
| `npm run build` / `npm start` | production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests (`tests/unit`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:parity` | exports test projects, recalculates them in LibreOffice and checks the totals match the app to the cent (needs `soffice` on the PATH; runs in CI) |
| `npm run test:e2e` | Playwright end-to-end tests (not set up yet) |
| `npm run commitlint` | checks your commit messages against `origin/main` |
| `npx supabase db reset` | re-runs all migrations and the seed |

## HTTP endpoints

Almost everything goes through server actions (below). There are two HTTP routes.

### `GET /api/projects/[id]/export`

Downloads the project as an .xlsx file. It uses the signed-in user's session cookie, so RLS decides what they can see.

| Status | Body |
|---|---|
| `200` | the .xlsx file, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `401` | `{ "error": "Palun logi sisse." }`: not signed in |
| `404` | `{ "error": "Projekti ei leitud." }`: bad id, missing project, or someone else's project |
| `500` | `{ "error": "Exceli faili loomine ebaõnnestus. Palun proovi uuesti." }` |

The file is named `<project-name>-<yyyy-mm-dd>.xlsx` (date in Tallinn time). Non-ASCII names like `Õie tänav 5` are sent with an RFC 5987 header: `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`. Every response is sent with `Cache-Control: no-store`, so a download is never cached.

This endpoint is a team contract. Don't change it without a `contract-change` PR.

### `GET /auth/confirm`

The link in the sign-up confirmation email. It signs the user in and redirects.

| Query param | Description |
|---|---|
| `code` | PKCE code (Supabase's default email link) |
| `token_hash` + `type` | token from a custom email template |
| `next` | where to go afterwards; only same-site paths are allowed, default `/projects` |

On failure it redirects to `/login?error=confirm`.

## Server actions

The UI changes data through Next.js server actions. Each one validates its input with zod (Estonian error messages), runs as the signed-in user so RLS applies, and returns `{ ok: true, data }` or `{ ok: false, error }`.

| File | Actions |
|---|---|
| `app/(auth)/actions.ts` | `signUp`, `signIn`, `signOut` |
| `app/projects/actions.ts` | `createProject`, `updateProject`, `deleteProject`, `updateProfile` (business name, default käibemaks) |
| `app/projects/[id]/actions.ts` | `addRow`, `updateRow`, `duplicateRow`, `deleteRow`, `reorderRows`, `addColumn`, `renameColumn`, `deleteColumn` |

The logic lives in `lib/actions/`, so it can be unit tested with a fake Supabase client.

## Project structure

```
app/
  (auth)/login/               login + sign-up page
  auth/confirm/               email confirmation route
  projects/                   projects list
  projects/[id]/              project page: table editor + totals
  settings/                   business name + default käibemaks
  api/projects/[id]/export/   .xlsx download
components/table/             table editor (rows, calc-type picker, totals, autosave)
lib/
  calc.ts                     calcRows() / calcProject(): the only place math happens
  excel/                      workbook generation (layout, formulas, formatting)
  actions/                    server action logic
  supabase/                   server + browser clients
  strings.et.ts               all Estonian UI and export text
  validation.ts               zod schemas
supabase/
  migrations/                 schema, RLS, functions (numbered SQL files)
  seed.sql                    demo data
tests/
  unit/                       Vitest
  parity/                     app ↔ Excel totals check (LibreOffice)
docs/
  database.md                 schema, RLS, triggers, RPCs
  backend/design.md           backend module map and calculation rules
```

## Contributing

1. Every piece of work starts from a GitHub issue.
2. Branch from `main` as `<area>/<issue#>-short-desc`, where area is `db`, `be`, `fe` or `qa` (`chore/` for cross-area setup), e.g. `fe/27-projects-list`.
3. Commit with the Angular convention: `type(scope): subject`, e.g. `feat(ui): add search to projects list`, with `Closes #27` in the footer.
4. Push and open a PR. It needs at least one reviewer, and the owner of each area it touches.
5. CI must pass: lint, typecheck, unit tests, build, commitlint and the parity check.

Schema changes are always a new migration file. After one, regenerate the types:

```sh
npx supabase gen types typescript --local > lib/types.db.ts
```
