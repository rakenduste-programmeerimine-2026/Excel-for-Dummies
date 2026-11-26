import 'server-only';
import type { Supabase } from '@/lib/queries';
import { validation as t } from '@/lib/strings.et';
import {
  createProjectSchema,
  definedOnly,
  idSchema,
  updateProfileSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProfileInput,
  type UpdateProjectInput,
} from '@/lib/validation';
import { fail, fromZodError, notSignedIn, ok, saveFailed, type ActionResult } from './result';

// Logic of the project server actions. Each function gets the user's Supabase client,
// so Row Level Security applies to every query. app/projects/actions.ts wraps them.

export async function currentUserId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** New project. Its tax rate is copied from the user's default; later changes to the default never touch it. */
export async function createProject(supabase: Supabase, input: CreateProjectInput): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId(supabase);
  if (!userId) return notSignedIn();
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { data: profile, error: profileError } = await supabase.from('profiles').select('default_tax_rate').eq('id', userId).maybeSingle();
  if (profileError) return saveFailed('createProject: load profile', profileError);
  if (!profile) return fail(t.profileMissing);

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: parsed.data.name,
      client: parsed.data.client ?? null,
      address: parsed.data.address ?? null,
      tax_rate: Number(profile.default_tax_rate),
    })
    .select('id')
    .single();
  if (error) return saveFailed('createProject: insert', error);
  return ok({ id: data.id });
}

/** Name, client, address and this project's own tax rate. Only the given fields change. */
export async function updateProject(supabase: Supabase, projectId: string, input: UpdateProjectInput): Promise<ActionResult> {
  const userId = await currentUserId(supabase);
  if (!userId) return notSignedIn();
  if (!idSchema.safeParse(projectId).success) return fail(t.projectNotFound);
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const patch = definedOnly(parsed.data);
  if (Object.keys(patch).length === 0) return ok(null);
  const { data, error } = await supabase.from('projects').update(patch).eq('id', projectId).select('id');
  if (error) return saveFailed('updateProject', error);
  if (!data?.length) return fail(t.projectNotFound); // missing, or RLS hides it
  return ok(null);
}

/** Deletes a project; its rows and columns go with it (on delete cascade). */
export async function deleteProject(supabase: Supabase, projectId: string): Promise<ActionResult> {
  const userId = await currentUserId(supabase);
  if (!userId) return notSignedIn();
  if (!idSchema.safeParse(projectId).success) return fail(t.projectNotFound);

  const { data, error } = await supabase.from('projects').delete().eq('id', projectId).select('id');
  if (error) return saveFailed('deleteProject', error);
  if (!data?.length) return fail(t.projectNotFound);
  return ok(null);
}

/** Business name (row 1 of the export) and the default tax rate for NEW projects. */
export async function updateProfile(supabase: Supabase, input: UpdateProfileInput): Promise<ActionResult> {
  const userId = await currentUserId(supabase);
  if (!userId) return notSignedIn();
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const patch = definedOnly(parsed.data);
  if (Object.keys(patch).length === 0) return ok(null);
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) return saveFailed('updateProfile', error);
  if (!data?.length) return fail(t.profileMissing);
  return ok(null);
}
