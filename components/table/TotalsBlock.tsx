import { isSubtotalNegative, type ProjectTotals } from '@/lib/calc';
import { formatEur } from '@/lib/format';
import { ui } from '@/lib/strings.et';
import styles from './TableEditor.module.css';

const labels = ui.table.totals;

type Props = {
  totals: ProjectTotals;
  taxRate: number;
};

export function TotalsBlock({ totals, taxRate }: Props) {
  return (
    <div className={styles.totals}>
      {isSubtotalNegative(totals) && (
        <p role="alert" className={styles.warning}>
          {ui.table.negativeSubtotal}
        </p>
      )}
      <dl className={styles.totalsList}>
        <div>
          <dt>{labels.subtotal}</dt>
          <dd>{formatEur(totals.subtotal)}</dd>
        </div>
        <div>
          <dt>{labels.taxRate}</dt>
          <dd>{taxRate.toLocaleString('et-EE')}%</dd>
        </div>
        <div>
          <dt>{labels.tax}</dt>
          <dd>{formatEur(totals.tax)}</dd>
        </div>
        <div className={styles.grandTotal}>
          <dt>{labels.total}</dt>
          <dd>{formatEur(totals.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
