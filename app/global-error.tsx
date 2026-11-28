'use client';

import { ui } from '@/lib/strings.et';
import './globals.css';
import layout from './layout.module.css';
import styles from './status.module.css';

// Replaces the root layout when the layout itself crashes, so it brings its own <html>, header and styles.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="et">
      <body>
        <title>{`${ui.status.errorTitle} · ${ui.appName}`}</title>
        <header className={layout.header}>
          <div className={layout.headerInner}>
            {/* A plain <a>: a full reload is the best recovery when the layout is broken. */}
            <a href="/projects" className={layout.logo}>
              {ui.appName}
            </a>
          </div>
        </header>
        <main className={layout.main}>
          <div className={styles.status}>
            <h1 className={styles.title}>{ui.status.errorTitle}</h1>
            <p className={styles.text}>{ui.status.errorText}</p>
            <button type="button" className={styles.primary} onClick={() => retry()}>
              {ui.status.retry}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
