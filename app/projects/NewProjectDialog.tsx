'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { ui, validation } from '@/lib/strings.et';
import { createProject, updateProject } from './actions';
import { readNewProjectForm, taxRateText } from './newProject';
import styles from './page.module.css';

const t = ui.projects;

export function NewProjectDialog({ defaultTaxRate }: { defaultTaxRate: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const read = readNewProjectForm(new FormData(e.currentTarget), defaultTaxRate);
    if (!read.ok) return setError(read.error);
    setPending(true);
    setError('');

    const fail = (message: string) => {
      setError(message);
      setPending(false);
    };
    try {
      const created = await createProject(read.input);
      if (!created.ok) return fail(created.error);
      if (read.taxRate !== null) {
        const updated = await updateProject(created.data.id, { tax_rate: read.taxRate });
        // Rare: the rate was checked above. The project exists with the default rate; open it anyway.
        if (!updated.ok) console.error('Setting the tax rate failed:', updated.error);
      }
      router.push(`/projects/${created.data.id}`);
    } catch {
      fail(validation.saveFailed); // network error or the server action threw
    }
  }

  return (
    <>
      <button type="button" className={styles.primary} onClick={() => dialog.current?.showModal()}>
        + {t.newProject}
      </button>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="new-project-title" onClose={() => setError('')}>
        <h1 id="new-project-title" className={styles.dialogTitle}>
          {t.newProject}
        </h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="project-name">{t.name}</label>
            <input
              className={styles.input}
              id="project-name"
              name="name"
              placeholder={t.namePlaceholder}
              maxLength={200}
              autoComplete="off"
              required
              autoFocus
              // The browser's own "fill in this field" text follows the browser language.
              onInvalid={(e) => e.currentTarget.setCustomValidity(t.nameRequired)}
              onInput={(e) => e.currentTarget.setCustomValidity('')}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="project-client">{t.client}</label>
            <input className={styles.input} id="project-client" name="client" maxLength={200} autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label htmlFor="project-address">{t.address}</label>
            <input className={styles.input} id="project-address" name="address" maxLength={300} autoComplete="street-address" />
          </div>
          <div className={styles.field}>
            <label htmlFor="project-tax">{t.taxRate}</label>
            <input
              className={`${styles.input} ${styles.taxInput}`}
              id="project-tax"
              name="tax_rate"
              type="text"
              inputMode="decimal"
              defaultValue={taxRateText(defaultTaxRate)}
              autoComplete="off"
            />
          </div>

          {/* Always rendered: a live region that only appears isn't announced reliably. */}
          <p role="alert" className={styles.error}>
            {error}
          </p>

          <div className={styles.dialogButtons}>
            <button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>
              {t.cancel}
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? t.pending : t.create}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
