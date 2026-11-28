import { ui } from '@/lib/strings.et';
import styles from './status.module.css';

export default function Loading() {
  return (
    <p role="status" className={styles.text}>
      {ui.status.loading}
    </p>
  );
}
