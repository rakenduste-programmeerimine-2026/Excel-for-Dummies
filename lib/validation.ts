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
