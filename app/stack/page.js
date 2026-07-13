import { createClient } from '../../lib/supabase/server.js';
import { resolveProjectAccess } from '../../lib/team/access.js';
import { listSchemes, schemeSummary } from '../../lib/stack/schemeStore.js';
import StackTool from './StackTool';
import styles from './stack.module.css';

/**
 * /stack: the STACK development appraisal and funding model. Fully behind auth
 * (the middleware gates the /stack prefix), for the signed-in organisation:
 * schemes save to and load from the organisation's store, an admin writes and
 * a member reads, the same access rule as every product surface. The
 * attachment to the shared Flitrr project spine comes later. It sits on the
 * product Instrument surface: a dark console header over the light paper
 * canvas.
 */
export default async function StackPage() {
  const supabase = await createClient();

  // The viewer's role, resolved once, and the organisation's saved schemes for
  // the first paint. Both degrade cleanly: a failed read renders the tool with
  // an empty list and a read-only surface, and row level security holds the
  // real line underneath either way.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);
  const { schemes } = await listSchemes(supabase);

  const initialSchemes = (schemes ?? []).map(schemeSummary);

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
        <StackTool
          initialSchemes={initialSchemes}
          canEdit={canEdit}
          adminContact={adminContact}
        />
      </div>
    </main>
  );
}
