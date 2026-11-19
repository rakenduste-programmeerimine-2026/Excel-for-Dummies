import type { ZodError } from 'zod';
import { api, validation } from '@/lib/strings.et';

/** What every server action returns. Messages are Estonian and safe to show to the user. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> =>
  fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };

export const notSignedIn = () => fail(api.notSignedIn);

/** One message per field (the first), plus the first message overall for a toast. */
export function fromZodError(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '_');
    fieldErrors[field] ??= issue.message;
  }
  return fail(error.issues[0]?.message ?? validation.saveFailed, fieldErrors);
}

/** Logs the technical error for us and returns a friendly message for the user. */
export function saveFailed(context: string, error: unknown): ActionResult<never> {
  console.error(`Server action failed: ${context}`, error);
  return fail(validation.saveFailed);
}
