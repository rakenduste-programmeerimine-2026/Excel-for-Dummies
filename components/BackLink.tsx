import Link from 'next/link';
import { ui } from '@/lib/strings.et';
import styles from './BackLink.module.css';

/** "← Projektid" button at the top of the project and settings pages. */
export function BackLink() {
  return (
    <Link href="/projects" className={styles.back}>
      {ui.backToProjects}
    </Link>
  );
}
