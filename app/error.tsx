'use client';

import Link from 'next/link';
import { ui } from '@/lib/strings.et';
import styles from './status.module.css';

// error.message is never shown: it's technical English text. Next logs it on the server.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={styles.status}>
      <title>{`${ui.status.errorTitle} · ${ui.appName}`}</title>
      <h1 className={styles.title}>{ui.status.errorTitle}</h1>
      <p className={styles.text}>{ui.status.errorText}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => retry()}>
          {ui.status.retry}
        </button>
        <Link href="/projects" className={styles.link}>
          {ui.status.backToProjects}
        </Link>
      </div>
    </div>
  );
}
