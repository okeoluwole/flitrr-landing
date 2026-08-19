import { createClient } from '../../../lib/supabase/server.js';
import { resolveProjectAccess } from '../../../lib/team/access.js';
import { listSchemes, schemeSummary } from '../../../lib/stack/schemeStore.js';
import StackTool from './StackTool';
import styles from './stack.module.css';

/**
 * /stack/app: the STACK development appraisal and funding model. Fully behind
 * auth (the middleware gates the /stack/app prefix), for the signed-in
 * organisation:
 * schemes save to and load from the organisation's store, an admin writes and
 * a member reads, the same access rule as every product surface. The
 * attachment to the shared Flitrr project spine comes later. It sits on the
 * product Instrument surface: the console header over the dark work canvas,
 * all from the --app-* tokens.
 */
export default async function StackPage() {
  const supabase = await createClient();

  // The viewer's role, resolved once; the organisation's saved schemes for
  // the first paint; and its active projects for the scheme project link
  // (039). All degrade cleanly: a failed read renders the tool with an empty
  // list and a read-only surface, and row level security holds the real line
  // underneath either way.
  const [{ canEdit, adminContact }, { schemes }, { data: projectRows }] =
    await Promise.all([
      resolveProjectAccess(supabase),
      listSchemes(supabase),
      supabase
        .from('projects')
        .select('id, name, archived_at')
        .order('name', { ascending: true }),
    ]);

  const initialSchemes = (schemes ?? []).map(schemeSummary);
  // Active projects only: an archived project is not offered for a NEW link
  // (a scheme already linked to one keeps its name via the scheme summary).
  const projects = (projectRows ?? [])
    .filter((p) => !p.archived_at)
    .map(({ id, name }) => ({ id, name }));

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
          projects={projects}
        />
      </div>
    </main>
  );
}
