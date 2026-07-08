import StackTool from './StackTool';
import styles from './stack.module.css';

/**
 * /stack: the STACK development appraisal and funding model. A standalone,
 * public tool for now; the account and organisation layer, and the attachment to
 * the shared Flitrr project spine, come later. It sits on the product Instrument
 * surface: a dark console header over the light paper canvas.
 */
export default function StackPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandFlitrr}>Flitrr</span>
          <span className={styles.brandProduct}>STACK</span>
        </div>
        <p className={styles.tagline}>Development appraisal and funding model</p>
      </header>

      <div className={styles.canvas}>
        <StackTool />
      </div>
    </main>
  );
}
