# Backend Design

Status: **design, to be approved before coding** (issue #1). Area: Backend.
It follows the team contracts in CLAUDE.md (schema, `lib/calc.ts`, export endpoint) and changes none of them.

## 1. Module map

| File | Purpose | Notes |
|---|---|---|
| `lib/calc.ts` | `calcRows()`, `calcProject()`: **the only place math happens** | pure; used by the UI *and* the export |
| `lib/excel/colLetter.ts` | `colLetter(index)`: 1 → A, 27 → AA | pure |
| `lib/excel/layout.ts` | row/column positions; letters shift with extra columns | pure |
| `lib/excel/buildWorkbook.ts` | `buildWorkbook(data): Promise<Buffer>` | server only (`import 'server-only'`), exceljs |
| `lib/excel/fileName.ts` | `<project-name>-<yyyy-mm-dd>.xlsx` + RFC 5987 header | pure |
| `lib/strings.et.ts` | Estonian text: **export** and **validation** sections only | the frontend owns the UI sections |
| `lib/supabase/server.ts`, `client.ts` | `@supabase/ssr` clients | anon key only, never the service-role key |
| `lib/queries.ts` | `getProjectForExport(supabase, id)` | used by the export endpoint |
| `lib/validation.ts` | zod schemas with Estonian messages | same per-calc-type rules as the DB check |
| `app/projects/actions.ts` | project + default tax rate actions | `"use server"` |
| `app/projects/[id]/actions.ts` | row + column actions | `"use server"` |
| `app/api/projects/[id]/export/route.ts` | `GET` → `.xlsx` | contract endpoint |

## 2. Calculation (contract, unchanged)

Internally everything is a scaled integer (BigInt): quantity in 1/1000, money in cents, percent in 1/100 %.
Every rounding step rounds half away from zero, like Excel `ROUND`:

| | app (`lib/calc.ts`) | Excel formula (same rounding step) |
|---|---|---|
| fixed | `unit_price` | `=G{r}` |
| qty_price | `round(quantity × unit_price, 2)` | `=ROUND(E{r}*G{r},2)` |
| percent | `round(sum of line totals above × percent / 100, 2)`; first row → 0 | `=ROUND(SUM(H{first}:H{r-1})*E{r},2)` / `=0` |
| subtotal | sum of line totals, **never clamped** | `=SUM(H{first}:H{last})` (`=0` with no rows) |
| tax | `round(subtotal × tax_rate / 100, 2)` | `=ROUND(Subtotal*TaxRate,2)` |
| total | `subtotal + tax` | `=Subtotal+Tax` |

Additional export (not a contract change): `isSubtotalNegative(totals)` for the frontend's warning.

## 3. Excel export mockup

Project with **one extra column** ("Ruum"), business "Kodu Remont OÜ", käibemaks 24 %, exported 19.11.2026.
Letters come from `colLetter`; with 0 or 3 extra columns, everything after *Kirjeldus* shifts.

```
     A    B           C              D         E          F               G              H
1  | Kodu Remont OÜ                                 (bold, 16 pt)
2  | Köögi remont · Mari Maasikas · Õie tänav 5, Tallinn · 19.11.2026
3  |
4  | Nr | Kuupäev    | Kirjeldus    | Ruum    | Kogus    | Ühik           | Ühiku hind | Summa          <- bold, filled, frozen
5  | 1  | 02.11.2026 | Seinavärv    | Köök    | 10       | l              |  12,50 €   | =ROUND(E5*G5,2)            125,00 €
6  | 2  | 03.11.2026 | Tööjõud      |         | 8        | h              |  25,00 €   | =ROUND(E6*G6,2)            200,00 €
7  | 3  |            | Transport    |         |          |                |  40,00 €   | =G7                         40,00 €
8  | 4  |            | Juurdehindlus|         | 15,00%   | ülalolevatest  |            | =ROUND(SUM(H5:H7)*E8,2)     54,75 €
9  | 5  |            | Allahindlus  |         | -10,00%  | ülalolevatest  |            | =ROUND(SUM(H5:H8)*E9,2)    -41,98 €  (red)
10 |
11 |                                                       Vahesumma                 | =SUM(H5:H9)                377,77 €  (bold)
12 |                                                       Käibemaksumäär            | 24,00%  (value 0.24)
13 |                                                       Käibemaks                 | =ROUND(H11*H12,2)           90,66 €
14 |                                                       Kokku koos käibemaksuga   | =H11+H13                   468,43 €
```
- Every formula cell also stores its **cached result** from `calcProject`.
- Money: `#,##0.00 "€"` with negatives in red; dates `dd.mm.yyyy`; percents `0.00%`.
- Thin borders on the table, auto column widths, header frozen (rows 1–4 stay visible). The totals block is bold.
- Zero rows: header and totals only, with every total `=0`.
- Fields a row's type doesn't use stay empty in the file, even if the DB still holds a value.
- Sheet name: the project name with `\ / ? * [ ] :` removed, cut to 31 characters.

## 4. Export endpoint (contract, unchanged)
`GET /api/projects/[id]/export`
- 401 if not signed in; 404 if the project doesn't exist **or** RLS hides it (no information leak). Error bodies are in Estonian.
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded name>`,
  e.g. `Õie tänav 5-2026-11-19.xlsx`. Characters not allowed in file names become `-`.
- The date in the name is the export date in Europe/Tallinn.

## 5. Server actions
All mutations validate with zod (Estonian messages) and return
`ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }`.
Each action calls `revalidatePath` for the affected page.

| Action | Input | Behaviour |
|---|---|---|
| `createProject` | name, client?, address? | `tax_rate` copied from `profiles.default_tax_rate` |
| `updateProject` | id, name?, client?, address?, tax_rate? | |
| `deleteProject` | id | rows and columns cascade |
| `updateDefaultTaxRate` | rate | affects **new** projects only |
| `addRow` | projectId | appended (`position = max + 1`, or 1 in an empty project) as an empty `fixed` row (unit price 0) |
| `updateRow` | rowId, patch | merged with the stored row and validated as a whole (works with debounced autosave) |
| `duplicateRow` | rowId | the copy is inserted at the end, then `reorder_rows` moves it directly below the original |
| `deleteRow` | rowId | |
| `reorderRows` | projectId, rowIds[] | one transaction (DB RPC) |
| `addColumn` | projectId, name | `position = max + 1`; rows get the key only when the user types a value |
| `renameColumn` | columnId, name | only `project_columns.name` changes (`rows.extra` is keyed by id) |
| `deleteColumn` | columnId | `delete_column` RPC |

**Switching calc type** fills missing required fields with safe defaults (quantity 1, unit price 0, percent 0), so an
autosave never fails half-way and the user never loses work.

Input rules (mirror the DB): numbers accept `,` or `.` and spaces as thousands separators (`1 234,50`);
quantity ≥ 0 with ≤ 3 decimals; unit price ≤ 2 decimals (negative allowed, e.g. a fixed discount);
percent −100 … 9999,99 with ≤ 2 decimals; tax rate 0 … 100 with ≤ 2 decimals.

## 6. Dependencies on other areas (to agree with their owners)
| From | What | Used by |
|---|---|---|
| Database | RPC `reorder_rows(p_project_id uuid, p_row_ids uuid[])`: the full new order, `p_row_ids[i]` gets `position = i` (1-based), one transaction, `security invoker` | `reorderRows`, `duplicateRow` |
| Database | RPC `delete_column(p_column_id uuid)`: strips the key from `rows.extra` and deletes the column in one transaction | `deleteColumn` |
| Database | Trigger `on_auth_user_created` creates the `profiles` row | `createProject` reads `default_tax_rate` from it |
| Database | Generated `lib/types.db.ts` | everything. Until it exists, a placeholder that matches the CLAUDE.md schema is committed and flagged for the database owner |
| Frontend | Calls these actions; uses `calcProject` for live totals and `isSubtotalNegative` for the warning; owns the UI sections of `lib/strings.et.ts` | |

Reference: the database design in `docs/database.md` (Database area). Its example table is used as a test case
for `calc.ts` and the export (subtotal 247,50 → käibemaks 59,40 → total 306,90).

## 7. Open questions
1. **App scaffold.** The repo is empty, and the backend needs the Next.js skeleton for actions and the route. Issue #2
   (`chore/2-…`) adds config only, with no pages. If another area already scaffolds, drop #2 and rebase.

## 8. Tests
- `lib/calc.ts`: every case CLAUDE.md requires.
- `lib/excel/`: layout, formulas, cached results and formatting, read back with exceljs.
- **Parity** (#12): exported files are recalculated by headless LibreOffice, and each formula result must equal `calcProject` to the cent.
- `lib/validation.ts`, the file name helper and the action helpers: unit tests.
