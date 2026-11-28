'use client';

import { useState, type FormEvent } from 'react';
import { ui, validation } from '@/lib/strings.et';
import { updateProfile } from '../projects/actions';
import { taxRateText } from '../projects/newProject';
import styles from '../projects/page.module.css';

const t = ui.settings;

export function SettingsForm({ businessName, defaultTaxRate }: { businessName: string; defaultTaxRate: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError('');
    setSaved(false);
    try {
      // The action's zod schema parses "22,5" and rejects an empty or out-of-range rate.
      const result = await updateProfile({
        business_name: String(form.get('business_name') ?? ''),
        default_tax_rate: String(form.get('default_tax_rate') ?? ''),
      });
      if (result.ok) setSaved(true);
      else setError(result.error);
    } catch {
      setError(validation.saveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} onInput={() => setSaved(false)}>
      <div className={styles.field}>
        <label htmlFor="business-name">{t.businessName}</label>
        <input
          className={styles.input}
          id="business-name"
          name="business_name"
          defaultValue={businessName}
          placeholder={t.businessNamePlaceholder}
          maxLength={200}
          autoComplete="organization"
          aria-describedby="business-name-hint"
        />
        <small id="business-name-hint">{t.businessNameHint}</small>
      </div>
      <div className={styles.field}>
        <label htmlFor="default-tax">{t.taxRate}</label>
        <input
          className={`${styles.input} ${styles.taxInput}`}
          id="default-tax"
          name="default_tax_rate"
          type="text"
          inputMode="decimal"
          defaultValue={taxRateText(defaultTaxRate)}
          autoComplete="off"
          aria-describedby="default-tax-hint"
        />
        <small id="default-tax-hint">{t.taxRateHint}</small>
      </div>

      {/* Always rendered: a live region that only appears isn't announced reliably. */}
      <p role="alert" className={styles.error}>
        {error}
      </p>

      <div className={styles.header}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? t.pending : t.save}
        </button>
        <p role="status">{saved ? t.saved : ''}</p>
      </div>
    </form>
  );
}
