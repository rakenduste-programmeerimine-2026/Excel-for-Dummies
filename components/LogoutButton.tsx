'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signOut } from '@/app/(auth)/actions';
import { ui } from '@/lib/strings.et';
import styles from '@/app/layout.module.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.logout} disabled={pending}>
      {pending ? ui.auth.pending : ui.auth.logout}
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function logout() {
    setError('');
    try {
      const result = await signOut();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push('/login');
      router.refresh(); // re-render the layout so the button disappears
    } catch {
      setError(ui.auth.errors.network);
    }
  }

  return (
    <form action={logout} className={styles.logoutForm}>
      <p role="alert" className={styles.logoutError}>
        {error}
      </p>
      <SubmitButton />
    </form>
  );
}
