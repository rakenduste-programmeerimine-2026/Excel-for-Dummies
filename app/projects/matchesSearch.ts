export type SearchableProject = { name: string; client: string | null; address: string | null };

/** Lower case without accents, so "Õie" and "oie" compare equal (phone keyboards make õäöü slow to type). */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** True when the search text appears in the project's name, client or address. Empty search matches all. */
export function matchesSearch(project: SearchableProject, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [project.name, project.client, project.address].some((field) => field != null && fold(field).includes(q));
}
