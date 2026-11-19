import type { Metadata } from 'next';
import { ui } from '@/lib/strings.et';
import styles from './page.module.css';

export const metadata: Metadata = { title: `${ui.projects.title} · ${ui.appName}` };

// Placeholder until the projects list is built.
export default function ProjectsPage() {
  return (
    <>
      <h1 className={styles.title}>{ui.projects.title}</h1>
      <p className={styles.empty}>{ui.projects.empty}</p>
    </>
  );
}
