// zod schemas for the server actions. They enforce the same rules as the database
// (numeric scales, per-calc-type required fields) so the user gets a friendly
// Estonian message instead of a database error.
import { z } from 'zod';
import { parseDecimal } from '@/lib/format';
import { validation as t } from '@/lib/strings.et';

export const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { error: t.invalidId });

const text = (max: number) => z.string({ error: t.tooLong(max) }).trim().max(max, { error: t.tooLong(max) });
/** Optional text: empty becomes null. */
const optionalText = (max: number) =>
  z
    .union([text(max), z.null()])
    .optional()
    .transform((v) => (v ? v : v === undefined ? undefined : null));

type Bounds = { min?: number; max?: number; minMessage?: string; maxMessage?: string };

/**
 * A number typed by the user ("12,50", "1 234,5", "−10") or sent as a number.
 * Empty -> null. Same parser as the table editor, so both accept exactly the same input.
 */
export function decimal(decimals: number, bounds: Bounds = {}) {
  // z.unknown() + our own checks, so every rejection (NaN, objects, …) gets the Estonian message.
  return z.unknown().transform((value, ctx): number | null => {
    if (value === null || value === undefined) return null;
    if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'number' && !Number.isFinite(value))) {
      ctx.addIssue({ code: 'custom', message: t.invalidNumber(decimals) });
      return z.NEVER;
    }
    const parsed = parseDecimal(typeof value === 'number' ? String(value) : value, decimals);
    if (parsed === 'invalid') {
      ctx.addIssue({ code: 'custom', message: t.invalidNumber(decimals) });
      return z.NEVER;
    }
    if (parsed !== null && bounds.min !== undefined && parsed < bounds.min) {
      ctx.addIssue({ code: 'custom', message: bounds.minMessage ?? t.numberTooLarge });
      return z.NEVER;
    }
    if (parsed !== null && bounds.max !== undefined && parsed > bounds.max) {
      ctx.addIssue({ code: 'custom', message: bounds.maxMessage ?? t.numberTooLarge });
      return z.NEVER;
    }
    return parsed === 0 ? 0 : parsed; // no -0
  });
}

/** numeric(5,2), 0..100 */
export const taxRate = decimal(2, { min: 0, max: 100, minMessage: t.taxRateRange, maxMessage: t.taxRateRange });

// ---- projects ---------------------------------------------------------------

export const createProjectSchema = z.object({
  name: text(200).min(1, { error: t.projectNameRequired }),
  client: optionalText(200),
  address: optionalText(300),
});

export const updateProjectSchema = z.object({
  name: text(200).min(1, { error: t.projectNameRequired }).optional(),
  client: optionalText(200),
  address: optionalText(300),
  tax_rate: taxRate.optional().refine((v) => v !== null, { error: t.taxRateRange }),
});

export const updateProfileSchema = z.object({
  business_name: optionalText(200),
  default_tax_rate: taxRate.optional().refine((v) => v !== null, { error: t.taxRateRange }),
});

/** A number field as the UI sends it: the typed text ("12,50"), a number, or empty (null). */
export type NumberInput = string | number | null;

export type CreateProjectInput = { name: string; client?: string | null; address?: string | null };
export type UpdateProjectInput = { name?: string; client?: string | null; address?: string | null; tax_rate?: NumberInput };
export type UpdateProfileInput = { business_name?: string | null; default_tax_rate?: NumberInput };

/** Drops keys whose value is undefined, so only the fields the user changed are written. */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ---- rows -------------------------------------------------------------------

export const calcTypeSchema = z.enum(['fixed', 'qty_price', 'percent'], { error: t.invalidCalcType });

/** numeric(12,3), never negative */
export const quantity = decimal(3, { min: 0, max: 999_999_999.999, minMessage: t.quantityNegative });
/** numeric(12,2); may be negative (e.g. a fixed discount) */
export const unitPrice = decimal(2, { min: -9_999_999_999.99, max: 9_999_999_999.99 });
/** numeric(6,2); negative = discount */
export const percent = decimal(2, { min: -100, max: 9999.99, minMessage: t.percentRange, maxMessage: t.percentRange });

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ET = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/** A date as yyyy-mm-dd (date input) or dd.mm.yyyy (typed); stored as yyyy-mm-dd. Empty -> null. */
export const dateField = z.unknown().transform((value, ctx): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const s = typeof value === 'string' ? value.trim() : '';
  const iso = ISO.exec(s);
  const et = ET.exec(s);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : et ? [et[3], et[2], et[1]] : [];
  const date = y && m && d ? new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))) : null;
  if (!date || date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) {
    ctx.addIssue({ code: 'custom', message: t.invalidDate });
    return z.NEVER;
  }
  return date.toISOString().slice(0, 10);
});

export const rowPatchSchema = z
  .object({
    date: dateField,
    description: text(500),
    calc_type: calcTypeSchema,
    quantity,
    unit: optionalText(30),
    unit_price: unitPrice,
    percent,
    extra: z.record(z.string(), text(500)),
  })
  .partial();

export type RowPatchInput = {
  date?: string | null;
  description?: string;
  calc_type?: 'fixed' | 'qty_price' | 'percent';
  quantity?: NumberInput;
  unit?: string | null;
  unit_price?: NumberInput;
  percent?: NumberInput;
  extra?: Record<string, string>;
};

type CalcFields = { calc_type: 'fixed' | 'qty_price' | 'percent'; quantity: number | null; unit_price: number | null; percent: number | null };

/** Same rule as the rows_required_fields check constraint in the database. */
export function requiredFieldErrors(row: CalcFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (row.calc_type === 'qty_price' && row.quantity === null) errors.quantity = t.quantityRequired;
  if ((row.calc_type === 'fixed' || row.calc_type === 'qty_price') && row.unit_price === null) errors.unit_price = t.unitPriceRequired;
  if (row.calc_type === 'percent' && row.percent === null) errors.percent = t.percentRequired;
  return errors;
}

/**
 * When the user switches a row's calc type, the fields the new type needs get safe defaults
 * (unless they already have a value), so the autosave succeeds and nothing the user typed is lost.
 */
export function calcTypeDefaults(row: CalcFields): Partial<CalcFields> {
  const defaults: Partial<CalcFields> = {};
  if (row.calc_type === 'qty_price' && row.quantity === null) defaults.quantity = 1;
  if ((row.calc_type === 'fixed' || row.calc_type === 'qty_price') && row.unit_price === null) defaults.unit_price = 0;
  if (row.calc_type === 'percent' && row.percent === null) defaults.percent = 0;
  return defaults;
}

export const rowOrderSchema = z
  .array(idSchema)
  .max(5000)
  .refine((ids) => new Set(ids).size === ids.length, { error: t.invalidOrder });

// ---- extra columns ----------------------------------------------------------

export const columnNameSchema = text(100).min(1, { error: t.columnNameRequired });
