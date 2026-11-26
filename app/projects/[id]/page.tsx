import type { Metadata } from 'next';
import { TableEditor } from '@/components/table/TableEditor';
import { ui } from '@/lib/strings.et';
import styles from './page.module.css';

export const metadata: Metadata = { title: `${ui.project.demoTitle} · ${ui.appName}` };

// shortcut: shows an empty table and nothing is saved; load the project by id from the database (#33).

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>{ui.project.demoTitle}</h1>
        {/* Plain <a>, not <Link>: it's a file download, not a page. Endpoint is the export contract (#7). */}
        <a href={`/api/projects/${encodeURIComponent(id)}/export`} className={styles.download} download>
          {ui.project.downloadExcel}
        </a>
      </div>
      <TableEditor initialRows={[]} taxRate={24} />
    </>
  );
}
