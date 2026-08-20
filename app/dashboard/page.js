import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import DashboardShell from '../components/DashboardShell';
import styles from './page.module.css';

/**
 * Returns the user's first name. Splits full_name on whitespace and
 * takes the first token; falls back to the email local-part; final
 * fallback is "there" so the greeting always reads.
 */
function deriveFirstName({ full_name, email }) {
  if (full_name) {
    const first = full_name.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (email) {
    return email.split('@')[0];
  }
  return 'there';
}

/**
 * Stable sort in lifecycle order, the same story the marketing pages tell:
 * STACK produces the decision, PULSE delivers it. Anything else follows
 * alphabetically.
 */
const LIFECYCLE_ORDER = ['stack', 'pulse'];

function sortProducts(rows) {
  const rank = (row) => {
    const i = LIFECYCLE_ORDER.indexOf(row.products.slug);
    return i === -1 ? LIFECYCLE_ORDER.length : i;
  };
  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.products.name.localeCompare(b.products.name);
  });
}

/**
 * What each product can say about itself on the launcher.
 *
 * One line, one number, in the numeric instrument voice. The launcher is a
 * surface a person passes through twice a day, so this stays deliberately
 * cheap: both reads are head-only, meaning the row bodies never leave the
 * database and only the count comes back. The deeper aggregate (which
 * critical actions are open against which objective) already exists in
 * lib/digest for the weekly email, and it is far too heavy to run on a
 * page whose whole job is to get out of the way.
 *
 * A product with no entry here simply renders no state line, so adding a
 * third product never breaks the launcher; it just stays quiet until
 * somebody teaches it what to count.
 */
const PRODUCT_STATE = {
  pulse: {
    // Active means not archived. A draft counts: it is work in progress,
    // and work in progress is the reason to open PULSE.
    read: (supabase) =>
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null),
    label: (n) => `${n} active ${n === 1 ? 'project' : 'projects'}`,
  },
  stack: {
    read: (supabase) =>
      supabase
        .from('stack_schemes')
        .select('id', { count: 'exact', head: true }),
    label: (n) => `${n} ${n === 1 ? 'scheme' : 'schemes'}`,
  },
};

/**
 * Reads one count per product the caller can actually open.
 *
 * Runs after the access round rather than alongside it, because that round
 * is what says which products this person has: a launcher should not query
 * a product's tables on behalf of somebody who cannot open it. Every failure
 * mode lands on the same answer, no line. A count that errors, a count that
 * comes back empty, and a count of zero are all "nothing to report", and the
 * card renders exactly as it did before this existed.
 */
async function readProductState(supabase, slugs) {
  const entries = await Promise.all(
    slugs
      .filter((slug) => PRODUCT_STATE[slug])
      .map(async (slug) => {
        const { count, error } = await PRODUCT_STATE[slug].read(supabase);
        if (error || !count) return [slug, null];
        return [slug, PRODUCT_STATE[slug].label(count)];
      })
  );
  return Object.fromEntries(entries);
}

/* No live/in-build vocabulary on the launcher: an available product simply
   opens. A planned product says "Coming soon." in place of its action. */
function ProductCard({ product, state = null }) {
  const { slug, name, description, status } = product;
  const isPlanned = status === 'planned';
  const href = slug === 'pulse' ? '/pulse/app' : `/${slug}/app`;

  return (
    <article className={styles.card}>
      <h2 className={styles.cardName}>{name}</h2>
      <p
        className={
          state ? styles.cardBody : `${styles.cardBody} ${styles.cardBodyGrow}`
        }
      >
        {description}
      </p>
      {state && <p className={styles.cardState}>{state}</p>}
      {isPlanned ? (
        <span className={styles.cardCtaMuted}>Coming soon.</span>
      ) : (
        <Link href={href} className={styles.cardCta}>
          Open {name}
        </Link>
      )}
    </article>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  // Parallel fetches: profile + product access + whether the caller is an org
  // admin (which surfaces the Team entry in the shell menu).
  const [{ data: profile }, { data: accessRows }, { data: isAdmin }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single(),
      supabase
        .from('product_access')
        .select(
          'granted_at, granted_by, products(slug, name, description, status)'
        )
        .eq('user_id', user.id),
      supabase.rpc('is_organisation_admin'),
    ]);

  const firstName = deriveFirstName({
    full_name: profile?.full_name,
    email: profile?.email ?? user.email,
  });

  const products = sortProducts(
    (accessRows ?? []).filter((row) => row.products) // defensive: drop rows with no joined product
  );

  // Second round, and only for products this person can open. A planned
  // product has nothing to count yet, so it is left out too.
  const productState = await readProductState(
    supabase,
    products
      .filter((row) => row.products.status !== 'planned')
      .map((row) => row.products.slug)
  );

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  return (
    <DashboardShell user={navUser} isAdmin={!!isAdmin}>
      <main className={`container ${styles.page}`} id="main-content">
        {/* The page title role, carrying the greeting and nothing else. The
            "Welcome to Flitrr" half was a first-session sentence being
            rendered on every session, and the line under it described the
            interface rather than telling the reader anything the cards do
            not already say. */}
        <h1 className={styles.heading}>Hi {firstName}.</h1>

        {products.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyHeading}>
              No products available yet.
            </h2>
            <p className={styles.emptyBody}>
              Check back soon, or contact us at hello@flitrr.com.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map((row) => (
              <ProductCard
                key={row.products.slug}
                product={row.products}
                state={productState[row.products.slug] ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
