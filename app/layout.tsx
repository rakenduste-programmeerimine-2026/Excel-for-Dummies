import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/LogoutButton';
import { ui } from '@/lib/strings.et';
import { createClient } from '@/lib/supabase/server';
import './globals.css';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: ui.appName,
  description: ui.appDescription,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="et">
      <body>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/projects" className={styles.logo}>
              {ui.appName}
            </Link>
            {user && <LogoutButton />}
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
