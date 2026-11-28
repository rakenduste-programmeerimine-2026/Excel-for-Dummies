import type { Metadata } from 'next';
import Link from 'next/link';
import { ui } from '@/lib/strings.et';
import styles from './status.module.css';

export const metadata: Metadata = { title: `${ui.status.notFoundTitle} · ${ui.appName}` };

export default function NotFound() {
  return (
    <div className={styles.status}>
      <h1 className={styles.title}>{ui.status.notFoundTitle}</h1>
      <p className={styles.text}>{ui.status.notFoundText}</p>
      <Link href="/projects" className={styles.link}>
        {ui.status.backToProjects}
      </Link>
    </div>
  );
}
