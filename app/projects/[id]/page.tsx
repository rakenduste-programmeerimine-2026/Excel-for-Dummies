import type { Metadata } from 'next';
import { TableEditor } from '@/components/table/TableEditor';
import { emptyRow } from '@/components/table/rowsReducer';
import type { EditorRow } from '@/components/table/types';
import { ui } from '@/lib/strings.et';
import styles from './page.module.css';

export const metadata: Metadata = { title: `${ui.project.demoTitle} · ${ui.appName}` };

// shortcut: every id shows these demo rows and nothing is saved; load the project by id once the database and row actions exist.
const demoRows: EditorRow[] = [
  {
    ...emptyRow('demo-1'),
    description: 'Seinte krohvimine',
    calc_type: 'qty_price',
    quantity: '10',
    unit: 'm²',
    unit_price: '4,50',
  },
  {
    ...emptyRow('demo-2'),
    description: 'Tööjõud',
    calc_type: 'qty_price',
    quantity: '8',
    unit: 'h',
    unit_price: '25',
  },
  { ...emptyRow('demo-3'), description: 'Transport', calc_type: 'fixed', unit_price: '30' },
  { ...emptyRow('demo-4'), description: 'Allahindlus', calc_type: 'percent', percent: '-10' },
];

export default function ProjectPage() {
  return (
    <>
      <h1 className={styles.title}>{ui.project.demoTitle}</h1>
      <TableEditor initialRows={demoRows} taxRate={24} />
    </>
  );
}
