import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { DeleteProjectButton } from '@/app/projects/DeleteProjectButton';
import { ProjectDialog } from '@/app/projects/ProjectDialog';
import { TableEditor } from '@/components/table/TableEditor';
import { toEditorRow } from '@/components/table/rowsReducer';
import { currentUserId } from '@/lib/actions/projects';
import { toRowData } from '@/lib/actions/rows';
import { toNumber } from '@/lib/queries';
import { ui } from '@/lib/strings.et';
import { createClient } from '@/lib/supabase/server';
import { idSchema } from '@/lib/validation';
// shortcut: out of alphabetical order to avoid a merge conflict with fe/57; sort after both merge
import { BackLink } from '@/components/BackLink';
import styles from './page.module.css';

type Params = { params: Promise<{ id: string }> };

// cache(): the page and its <title> share one load per request.
// Runs as the signed-in user, so RLS returns null for someone else's project.
const loadProject = cache(async (id: string) => {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data: project, error } = await supabase.from('projects').select('name, client, address, tax_rate').eq('id', id).maybeSingle();
  if (error) throw new Error(`Loading project failed: ${error.message}`);
  if (!project) return null;

  const { data: rows, error: rowsError } = await supabase
    .from('rows')
    .select('*')
    .eq('project_id', id)
    .order('position')
    .order('created_at');
  if (rowsError) throw new Error(`Loading rows failed: ${rowsError.message}`);

  return {
    name: project.name,
    client: project.client,
    address: project.address,
    taxRate: toNumber(project.tax_rate) ?? 0,
    rows: rows.map((row) => toEditorRow(toRowData(row))),
  };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = await loadProject((await params).id);
  return { title: `${project?.name ?? ui.project.fallbackTitle} · ${ui.appName}` };
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params;
  if (!(await currentUserId(await createClient()))) redirect('/login');
  const project = await loadProject(id);
  if (!project) notFound();
  const details = [project.client, project.address].filter(Boolean).join(' · ');

  return (
    <>
      <BackLink />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{project.name}</h1>
          {details && <p className={styles.details}>{details}</p>}
        </div>
        <div className={styles.buttons}>
          <ProjectDialog project={{ id, name: project.name, client: project.client, address: project.address, tax_rate: project.taxRate }} />
          {/* Plain <a>, not <Link>: it's a file download, not a page. Endpoint is the export contract (#7). */}
          <a href={`/api/projects/${encodeURIComponent(id)}/export`} className={styles.download} download>
            {ui.project.downloadExcel}
          </a>
        </div>
      </div>
      <TableEditor projectId={id} initialRows={project.rows} taxRate={project.taxRate} />
      {/* Kept away from the everyday buttons at the top. */}
      <div className={styles.dangerZone}>
        <DeleteProjectButton id={id} name={project.name} redirectTo="/projects" />
      </div>
    </>
  );
}
