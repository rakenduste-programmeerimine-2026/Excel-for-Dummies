import { validation } from '@/lib/strings.et';
import { taxRate, type CreateProjectInput } from '@/lib/validation';

/** 24 → "24", 22.5 → "22,5": how the tax rate field shows the user's default. */
export const taxRateText = (rate: number) => String(rate).replace('.', ',');

/**
 * Reads the "Uus projekt" form. createProject always copies the user's default tax rate,
 * so `taxRate` is set only when the user changed it and needs a follow-up updateProject.
 * The rate is checked before anything is created, so a bad rate never leaves a half-made project.
 */
export function readNewProjectForm(
  form: FormData,
  defaultTaxRate: number,
): { ok: true; input: CreateProjectInput; taxRate: number | null } | { ok: false; error: string } {
  const parsed = taxRate.safeParse(String(form.get('tax_rate') ?? ''));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  // Empty means "not given" in the shared schema; here the rate is required.
  if (parsed.data === null) return { ok: false, error: validation.taxRateRange };
  return {
    ok: true,
    input: { name: String(form.get('name') ?? ''), client: String(form.get('client') ?? ''), address: String(form.get('address') ?? '') },
    taxRate: parsed.data === defaultTaxRate ? null : parsed.data,
  };
}
