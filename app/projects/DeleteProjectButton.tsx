'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { ui, validation } from '@/lib/strings.et';
import { deleteProject } from './actions';
import styles from './page.module.css';

const t = ui.projects;

/** On the projects list it refreshes in place; with `redirectTo` (the project's own page) it leaves the deleted page. */
export function DeleteProjectButton({ id, name, redirectTo }: { id: string; name: string; redirectTo?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setPending(true);
    setError('');
    try {
      const result = await deleteProject(id);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      dialog.current?.close();
      if (redirectTo) router.push(redirectTo);
      else router.refresh(); // the action revalidates /projects; refresh shows it without a reload
    } catch {
      setError(validation.saveFailed);
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className={styles.deleteButton} aria-label={t.deleteLabel(name)} onClick={() => dialog.current?.showModal()}>
        {redirectTo ? t.deleteProject : t.delete}
      </button>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={() => setError('')}>
        <h1 id={titleId} className={styles.dialogTitle}>
          {t.deleteTitle}
        </h1>
        <p>{t.deleteText(name)}</p>
        <p role="alert" className={styles.error}>
          {error}
        </p>
        <div className={styles.dialogButtons}>
          {/* The safe choice gets focus, so Enter never deletes by accident. */}
          <button type="button" className={styles.secondary} autoFocus onClick={() => dialog.current?.close()}>
            {t.cancel}
          </button>
          <button type="button" className={styles.danger} disabled={pending} onClick={handleDelete}>
            {pending ? t.pending : t.delete}
          </button>
        </div>
      </dialog>
    </>
  );
}
