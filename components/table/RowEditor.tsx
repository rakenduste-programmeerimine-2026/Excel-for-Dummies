'use client';

import { useId, type Dispatch } from 'react';
import type { CalcType } from '@/lib/calc';
import { formatEur, parseDecimal } from '@/lib/format';
import { ui } from '@/lib/strings.et';
import { RowMenu } from './RowMenu';
import type { RowsAction } from './rowsReducer';
import { DECIMALS, type EditorRow } from './types';
import styles from './TableEditor.module.css';

const t = ui.table;
const calcTypes = Object.keys(t.calcTypes) as CalcType[];

type Props = {
  row: EditorRow;
  no: number;
  lineTotal: number;
  isFirst: boolean;
  isLast: boolean;
  dispatch: Dispatch<RowsAction>;
  onDuplicate: () => void;
};

export function RowEditor({ row, no, lineTotal, isFirst, isLast, dispatch, onDuplicate }: Props) {
  const label = (field: string) => `${field}, ${t.rowLabel(no)}`;
  const update = (patch: Partial<Omit<EditorRow, 'id'>>) => dispatch({ type: 'update', id: row.id, patch });

  const unitPriceField = (
    <NumberField
      value={row.unit_price}
      decimals={DECIMALS.unit_price}
      label={label(t.columns.unitPrice)}
      onChange={(unit_price) => update({ unit_price })}
    />
  );

  return (
    <tr className={styles.row}>
      <td className={styles.no}>{no}</td>
      <td>
        <input
          className={`${styles.input} ${styles.description}`}
          value={row.description}
          placeholder={t.descriptionPlaceholder}
          onChange={(e) => update({ description: e.target.value })}
          aria-label={label(t.columns.description)}
        />
      </td>
      <td>
        <select
          className={styles.input}
          value={row.calc_type}
          onChange={(e) => update({ calc_type: e.target.value as CalcType })}
          aria-label={label(t.columns.calcType)}
        >
          {calcTypes.map((type) => (
            <option key={type} value={type}>
              {t.calcTypes[type]}
            </option>
          ))}
        </select>
      </td>

      {/* Only the inputs this calc type uses; the others are hidden, not disabled. */}
      {row.calc_type === 'qty_price' && (
        <>
          <td>
            <NumberField
              value={row.quantity}
              decimals={DECIMALS.quantity}
              label={label(t.columns.quantity)}
              onChange={(quantity) => update({ quantity })}
            />
          </td>
          <td>
            <input
              className={`${styles.input} ${styles.unit}`}
              value={row.unit}
              placeholder={t.unitPlaceholder}
              onChange={(e) => update({ unit: e.target.value })}
              aria-label={label(t.columns.unit)}
            />
          </td>
          <td>{unitPriceField}</td>
        </>
      )}
      {row.calc_type === 'fixed' && (
        <>
          <td colSpan={2} />
          <td>{unitPriceField}</td>
        </>
      )}
      {row.calc_type === 'percent' && (
        <td colSpan={3}>
          <div className={styles.percent}>
            <NumberField
              value={row.percent}
              decimals={DECIMALS.percent}
              label={label(t.columns.percent)}
              onChange={(percent) => update({ percent })}
            />
            <span className={styles.percentSuffix}>{t.percentSuffix}</span>
          </div>
        </td>
      )}

      <td className={`${styles.total} ${lineTotal < 0 ? styles.negative : ''}`}>{formatEur(lineTotal)}</td>
      <td>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            disabled={isFirst}
            onClick={() => dispatch({ type: 'move', id: row.id, direction: -1 })}
            aria-label={label(t.moveUp)}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconButton}
            disabled={isLast}
            onClick={() => dispatch({ type: 'move', id: row.id, direction: 1 })}
            aria-label={label(t.moveDown)}
          >
            ↓
          </button>
          <RowMenu
            label={label(t.moreActions)}
            onDuplicate={onDuplicate}
            onDelete={() => dispatch({ type: 'delete', id: row.id })}
          />
        </div>
      </td>
    </tr>
  );
}

type NumberFieldProps = {
  value: string;
  decimals: number;
  label: string;
  onChange: (value: string) => void;
};

// Text input, not type="number": number inputs reject "12,50" in some browsers and locales.
function NumberField({ value, decimals, label, onChange }: NumberFieldProps) {
  const errorId = useId();
  const invalid = parseDecimal(value, decimals) === 'invalid';
  return (
    <div className={styles.field}>
      <input
        type="text"
        inputMode="decimal"
        className={`${styles.input} ${styles.number}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid && (
        <p id={errorId} className={styles.error}>
          {t.invalidNumber(decimals)}
        </p>
      )}
    </div>
  );
}
