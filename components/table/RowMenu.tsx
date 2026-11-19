'use client';

import { useId } from 'react';
import { ui } from '@/lib/strings.et';
import styles from './TableEditor.module.css';

type Props = {
  label: string;
  onDuplicate: () => void;
  onDelete: () => void;
};

// Native popover: Esc, click outside and focus handling come from the browser.
export function RowMenu({ label, onDuplicate, onDelete }: Props) {
  const id = useId();
  return (
    <>
      <button type="button" className={styles.iconButton} popoverTarget={id} aria-label={label}>
        ⋯
      </button>
      <div id={id} popover="auto" className={styles.menu}>
        <button
          type="button"
          className={styles.menuItem}
          popoverTarget={id}
          popoverTargetAction="hide"
          onClick={onDuplicate}
        >
          {ui.table.duplicate}
        </button>
        <button
          type="button"
          className={`${styles.menuItem} ${styles.danger}`}
          popoverTarget={id}
          popoverTargetAction="hide"
          onClick={onDelete}
        >
          {ui.table.delete}
        </button>
      </div>
    </>
  );
}
