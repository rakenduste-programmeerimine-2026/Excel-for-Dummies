import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/queries';
import { ui } from '@/lib/strings.et';
import { createClient } from '@/lib/supabase/server';
import styles from '../projects/page.module.css';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: `${ui.settings.title} · ${ui.appName}` };

export default async function SettingsPage() {
  const profile = await getProfile(await createClient());
  if (!profile) redirect('/login');

  return (
    <>
      <Link href="/projects">{ui.settings.back}</Link>
      <div className={styles.header}>
        <h1 className={styles.title}>{ui.settings.title}</h1>
      </div>
      <SettingsForm businessName={profile.business_name ?? ''} defaultTaxRate={profile.default_tax_rate} />
    </>
  );
}
