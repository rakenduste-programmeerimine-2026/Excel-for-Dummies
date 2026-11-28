'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import * as rowActions from '@/app/projects/[id]/actions';
import { calcProject } from '@/lib/calc';
import { ui } from '@/lib/strings.et';
import { Autosaver, type SaveStatus } from './autosave';
import { RowEditor } from './RowEditor';
import { rowsReducer, toEditorRow, toRowInput, type RowsAction } from './rowsReducer';
import { TotalsBlock } from './TotalsBlock';
import type { EditorRow } from './types';
import styles from './TableEditor.module.css';

const t = ui.table;

// crypto.randomUUID only exists in secure contexts (https, localhost), not when testing a phone over the LAN.
// The fallback still builds a v4 UUID, because the server actions only accept UUIDs as row ids.
const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16),
      );

const statusText = (status: SaveStatus) =>
  status.state === 'saving' ? t.saving : status.state === 'saved' ? t.saved : status.state === 'error' ? status.message : '';

type Props = {
  projectId: string;
  initialRows: EditorRow[];
  taxRate: number;
};

export function TableEditor({ projectId, initialRows, taxRate }: Props) {
  const [rows, dispatch] = useReducer(rowsReducer, initialRows);
  const [status, setStatus] = useState<SaveStatus>({ state: 'idle' });
  const [saver] = useState(
    () =>
      new Autosaver(projectId, rowActions, setStatus, (saved) => {
        const { quantity, unit_price, percent } = toEditorRow(saved);
        dispatch({ type: 'fillEmpty', id: saved.id, values: { quantity, unit_price, percent } });
      }),
  );
  const showQuantity = rows.some((row) => row.calc_type === 'qty_price');
  const totals = useMemo(() => calcProject(rows.map(toRowInput), taxRate), [rows, taxRate]);

  // Leaving the page: send waiting edits now, and let the browser warn while saves are still running.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saver.hasUnsaved()) return;
      saver.flushAll();
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      saver.flushAll(); // navigating inside the app unmounts the editor
    };
  }, [saver]);

  // Every change shows at once and is saved in the background.
  function apply(action: RowsAction) {
    dispatch(action);
    switch (action.type) {
      case 'add':
        return saver.add(action.id);
      case 'update':
        return saver.update(action.id, action.patch);
      case 'duplicate':
        return saver.duplicate(action.id, action.newId);
      case 'delete':
        return saver.delete(action.id);
      case 'move': {
        const next = rowsReducer(rows, action);
        if (next !== rows) saver.reorder(next.map((row) => row.id));
        return;
      }
    }
  }

  return (
    <section className={styles.editor}>
      <p role="status" className={status.state === 'error' ? styles.saveError : styles.saveStatus}>
        {statusText(status)}
      </p>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t.empty}</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.no}>{t.columns.no}</th>
                <th>{t.columns.description}</th>
                <th>{t.columns.calcType}</th>
                {showQuantity && (
                  <>
                    <th>{t.columns.quantity}</th>
                    <th>{t.columns.unit}</th>
                  </>
                )}
                <th>{t.columns.unitPrice}</th>
                <th className={styles.total}>{t.columns.total}</th>
                <th>
                  <span className={styles.srOnly}>{t.columns.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <RowEditor
                  key={row.id}
                  row={row}
                  no={index + 1}
                  lineTotal={totals.lineTotals[index] ?? 0}
                  isFirst={index === 0}
                  isLast={index === rows.length - 1}
                  dispatch={apply}
                  onDuplicate={() => apply({ type: 'duplicate', id: row.id, newId: newId() })}
                  showQuantity={showQuantity}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className={styles.addButton} onClick={() => apply({ type: 'add', id: newId() })}>
        + {t.addRow}
      </button>

      <TotalsBlock totals={totals} taxRate={taxRate} />
    </section>
  );
}
