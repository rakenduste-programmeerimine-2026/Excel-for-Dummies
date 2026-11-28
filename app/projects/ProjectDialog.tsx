'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ui, validation } from '@/lib/strings.et';
import { createProject, updateProject } from './actions';
import { readNewProjectForm, taxRateText } from './newProject';
import styles from './page.module.css';

const t = ui.projects;

type EditableProject = { id: string; name: string; client: string | null; address: string | null; tax_rate: number };

/** Without `project`: the "Uus projekt" dialog (tax rate from the default). With it: "Muuda projekti". */
type Props = { defaultTaxRate: number; project?: never } | { project: EditableProject; defaultTaxRate?: never };

export function ProjectDialog({ defaultTaxRate, project }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const taxRate = project ? project.tax_rate : defaultTaxRate;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const read = readNewProjectForm(new FormData(e.currentTarget), taxRate);
    if (!read.ok) return setError(read.error);
    setPending(true);
    setError('');

    const fail = (message: string) => {
      setError(message);
      setPending(false);
    };
    try {
      if (project) {
        const updated = await updateProject(project.id, { ...read.input, ...(read.taxRate !== null && { tax_rate: read.taxRate }) });
        if (!updated.ok) return fail(updated.error);
        setPending(false);
        dialog.current?.close();
        router.refresh(); // the action revalidates the page; refresh shows the new name, details and totals
        return;
      }
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
      <button type="button" className={project ? styles.secondary : styles.primary} onClick={() => dialog.current?.showModal()}>
        {project ? t.edit : `+ ${t.newProject}`}
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setError('');
          form.current?.reset(); // cancelled edits don't come back next time
        }}
      >
        <h1 id={`${id}-title`} className={styles.dialogTitle}>
          {project ? t.editTitle : t.newProject}
        </h1>
        <form ref={form} className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor={`${id}-name`}>{t.name}</label>
            <input
              className={styles.input}
              id={`${id}-name`}
              name="name"
              defaultValue={project?.name}
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
            <label htmlFor={`${id}-client`}>{t.client}</label>
            <input className={styles.input} id={`${id}-client`} name="client" defaultValue={project?.client ?? ''} maxLength={200} autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-address`}>{t.address}</label>
            <input
              className={styles.input}
              id={`${id}-address`}
              name="address"
              defaultValue={project?.address ?? ''}
              maxLength={300}
              autoComplete="street-address"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-tax`}>{t.taxRate}</label>
            <input
              className={`${styles.input} ${styles.taxInput}`}
              id={`${id}-tax`}
              name="tax_rate"
              type="text"
              inputMode="decimal"
              defaultValue={taxRateText(taxRate)}
              autoComplete="off"
              aria-describedby={project ? `${id}-tax-hint` : undefined}
            />
            {project && <small id={`${id}-tax-hint`}>{t.taxRateProjectHint}</small>}
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
              {pending ? t.pending : project ? t.save : t.create}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
