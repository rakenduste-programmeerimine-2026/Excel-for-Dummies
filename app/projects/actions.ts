'use server';

import { revalidatePath } from 'next/cache';
import * as projects from '@/lib/actions/projects';
import type { ActionResult } from '@/lib/actions/result';
import { createClient } from '@/lib/supabase/server';
import type { CreateProjectInput, UpdateProfileInput, UpdateProjectInput } from '@/lib/validation';

// Server actions for projects and the user's profile. Validation and messages live in
// lib/actions/projects.ts; these wrappers add the session client and refresh the pages.

export async function createProject(input: CreateProjectInput): Promise<ActionResult<{ id: string }>> {
  const result = await projects.createProject(await createClient(), input);
  if (result.ok) revalidatePath('/projects');
  return result;
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<ActionResult> {
  const result = await projects.updateProject(await createClient(), projectId, input);
  if (result.ok) {
    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
  }
  return result;
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const result = await projects.deleteProject(await createClient(), projectId);
  if (result.ok) revalidatePath('/projects');
  return result;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  return projects.updateProfile(await createClient(), input);
}
