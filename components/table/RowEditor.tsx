'use client';

import { useId, useRef, useState, type Dispatch } from 'react';
import { flushSync } from 'react-dom';
import type { CalcType } from '@/lib/calc';
import { formatEur, parseDecimal } from '@/lib/format';
import { ui } from '@/lib/strings.et';
import { RowMenu } from './RowMenu';
import type { RowsAction } from './rowsReducer';
import { DECIMALS, type EditorRow } from './types';
import styles from './TableEditor.module.css';

const t = ui.table;

/** Field name shown above an input in the phone card layout (where there are no column headers).
 * Hidden from screen readers: each input already has a full name like "Kogus, rida 2". */
const CardLabel = ({ children }: { children: string }) => (
  <span className={styles.cardLabel} aria-hidden="true">
    {children}
  </span>
);
const calcTypes = Object.keys(t.calcTypes) as CalcType[];

type Props = {
  row: EditorRow;
  no: number;
  lineTotal: number;
  isFirst: boolean;
  isLast: boolean;
  dispatch: Dispatch<RowsAction>;
  onDuplicate: () => void;
  /** False when no row is "Kogus × hind": the Kogus and Ühik columns are hidden. */
  showQuantity: boolean;
};

export function RowEditor({ row, no, lineTotal, isFirst, isLast, dispatch, onDuplicate, showQuantity }: Props) {
  const label = (field: string) => `${field}, ${t.rowLabel(no)}`;
  const update = (patch: Partial<Omit<EditorRow, 'id'>>) => dispatch({ type: 'update', id: row.id, patch });

  const unitPriceField = (
    <>
      <CardLabel>{t.columns.unitPrice}</CardLabel>
      <NumberField
        value={row.unit_price}
        decimals={DECIMALS.unit_price}
        label={label(t.columns.unitPrice)}
        onChange={(unit_price) => update({ unit_price })}
      />
    </>
  );

  return (
    <tr className={styles.row}>
      <td className={styles.no}>{no}</td>
      <td className={styles.cellDescription}>
        <input
          className={`${styles.input} ${styles.description}`}
          value={row.description}
          placeholder={t.descriptionPlaceholder}
          onChange={(e) => update({ description: e.target.value })}
          aria-label={label(t.columns.description)}
        />
      </td>
      <td>
        <CardLabel>{t.columns.calcType}</CardLabel>
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
          <td className={styles.cellQuantity}>
            <CardLabel>{t.columns.quantity}</CardLabel>
            <NumberField
              value={row.quantity}
              decimals={DECIMALS.quantity}
              label={label(t.columns.quantity)}
              onChange={(quantity) => update({ quantity })}
            />
          </td>
          <td className={styles.cellUnit}>
            <CardLabel>{t.columns.unit}</CardLabel>
            <UnitField value={row.unit} label={label(t.columns.unit)} onChange={(unit) => update({ unit })} />
          </td>
          <td>{unitPriceField}</td>
        </>
      )}
      {row.calc_type === 'fixed' && (
        <>
          {showQuantity && <td colSpan={2} className={styles.cellSpacer} />}
          <td>{unitPriceField}</td>
        </>
      )}
      {row.calc_type === 'percent' && (
        <td colSpan={showQuantity ? 3 : 1}>
          <CardLabel>{t.columns.percent}</CardLabel>
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
      <td className={styles.cellActions}>
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

type UnitFieldProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
};

const OTHER = '__other__';

/** Unit dropdown with a "Muu…" option that reveals a text input for units not on the list. */
function UnitField({ value, label, onChange }: UnitFieldProps) {
  const customInput = useRef<HTMLInputElement>(null);
  // A saved unit that isn't on the list opens in "Muu…" mode, so nothing is lost.
  const [custom, setCustom] = useState(value !== '' && !t.units.includes(value));

  function pick(selected: string) {
    if (selected !== OTHER) {
      setCustom(false);
      onChange(selected);
      return;
    }
    flushSync(() => setCustom(true)); // render the text input before focusing it
    onChange('');
    customInput.current?.focus();
  }

  return (
    <div className={styles.field}>
      <select className={`${styles.input} ${styles.unit}`} value={custom ? OTHER : value} onChange={(e) => pick(e.target.value)} aria-label={label}>
        <option value="">{t.unitNone}</option>
        {t.units.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
        <option value={OTHER}>{t.unitOther}</option>
      </select>
      {custom && (
        <input
          ref={customInput}
          className={`${styles.input} ${styles.unit}`}
          value={value}
          maxLength={30}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label}, ${t.unitCustom}`}
        />
      )}
    </div>
  );
}
