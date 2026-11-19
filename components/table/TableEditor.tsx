'use client';

import { useMemo, useReducer } from 'react';
import { calcProject } from '@/lib/calc';
import { ui } from '@/lib/strings.et';
import { RowEditor } from './RowEditor';
import { rowsReducer, toRowInput } from './rowsReducer';
import { TotalsBlock } from './TotalsBlock';
import type { EditorRow } from './types';
import styles from './TableEditor.module.css';

const t = ui.table;

// crypto.randomUUID only exists in secure contexts (https, localhost), not when testing a phone over the LAN.
const newId = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Props = {
  initialRows: EditorRow[];
  taxRate: number;
};

export function TableEditor({ initialRows, taxRate }: Props) {
  const [rows, dispatch] = useReducer(rowsReducer, initialRows);
  const totals = useMemo(() => calcProject(rows.map(toRowInput), taxRate), [rows, taxRate]);

  return (
    <section>
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
                <th>{t.columns.quantity}</th>
                <th>{t.columns.unit}</th>
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
                  dispatch={dispatch}
                  onDuplicate={() => dispatch({ type: 'duplicate', id: row.id, newId: newId() })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className={styles.addButton} onClick={() => dispatch({ type: 'add', id: newId() })}>
        + {t.addRow}
      </button>

      <TotalsBlock totals={totals} taxRate={taxRate} />
    </section>
  );
}
