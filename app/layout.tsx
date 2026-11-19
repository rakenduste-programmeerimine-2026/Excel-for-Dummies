import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ui } from '@/lib/strings.et';
import './globals.css';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: ui.appName,
  description: ui.appDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="et">
      <body>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/projects" className={styles.logo}>
              {ui.appName}
            </Link>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
