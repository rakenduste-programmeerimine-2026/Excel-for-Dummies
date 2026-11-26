import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUserId } from '@/lib/actions/projects';
import { toNumber } from '@/lib/queries';
import { ui } from '@/lib/strings.et';
import { createClient } from '@/lib/supabase/server';
import { DeleteProjectButton } from './DeleteProjectButton';
import { NewProjectDialog } from './NewProjectDialog';
import styles from './page.module.css';

export const metadata: Metadata = { title: `${ui.projects.title} · ${ui.appName}` };

const t = ui.projects;

export default async function ProjectsPage() {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) redirect('/login');

  // RLS returns only this user's projects.
  const [projects, profile] = await Promise.all([
    supabase.from('projects').select('id, name, client, address').order('created_at', { ascending: false }),
    supabase.from('profiles').select('default_tax_rate').eq('id', userId).maybeSingle(),
  ]);
  if (projects.error) throw new Error(`Loading projects failed: ${projects.error.message}`);
  if (profile.error) throw new Error(`Loading profile failed: ${profile.error.message}`);
  // 24 is the column default; a missing profile row makes createProject explain the problem.
  const defaultTaxRate = toNumber(profile.data?.default_tax_rate) ?? 24;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.title}</h1>
        <NewProjectDialog defaultTaxRate={defaultTaxRate} />
      </div>

      {projects.data.length === 0 ? (
        <div className={styles.empty}>
          <p>{t.empty}</p>
          <p>{t.emptyHint}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {projects.data.map((project) => {
            const details = [project.client, project.address].filter(Boolean).join(' · ');
            return (
              <li key={project.id} className={styles.card}>
                <Link href={`/projects/${project.id}`} className={styles.cardLink}>
                  <span className={styles.cardName}>{project.name}</span>
                  {details && <span className={styles.cardDetails}>{details}</span>}
                </Link>
                <DeleteProjectButton id={project.id} name={project.name} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
