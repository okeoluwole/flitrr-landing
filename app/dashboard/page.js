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
 * Stable sort: PULSE first, then alphabetical by product name.
 */
function sortProducts(rows) {
  return [...rows].sort((a, b) => {
    const aIsPulse = a.products.slug === 'pulse';
    const bIsPulse = b.products.slug === 'pulse';
    if (aIsPulse && !bIsPulse) return -1;
    if (!aIsPulse && bIsPulse) return 1;
    return a.products.name.localeCompare(b.products.name);
  });
}

function StatusPill({ status }) {
  if (status === 'live') {
    return <span className={`${styles.pill} ${styles.pillLive}`}>Live</span>;
  }
  if (status === 'in_build') {
    return (
      <span className={`${styles.pill} ${styles.pillInBuild}`}>In build</span>
    );
  }
  // status === 'planned' (or unknown) → muted
  return (
    <span className={`${styles.pill} ${styles.pillPlanned}`}>Planned</span>
  );
}

function ProductCard({ product }) {
  const { slug, name, description, status } = product;
  const isPlanned = status === 'planned';
  const href = slug === 'pulse' ? '/pulse/app' : `/${slug}/app`;

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardName}>{name}</h2>
        <StatusPill status={status} />
      </div>
      <p className={styles.cardBody}>{description}</p>
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

  // Parallel fetches: profile + product access.
  const [{ data: profile }, { data: accessRows }] = await Promise.all([
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
  ]);

  const firstName = deriveFirstName({
    full_name: profile?.full_name,
    email: profile?.email ?? user.email,
  });

  const products = sortProducts(
    (accessRows ?? []).filter((row) => row.products) // defensive: drop rows with no joined product
  );

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <h1 className={styles.heading}>
          Hi {firstName}. Welcome to Flitrr.
        </h1>
        <p className={styles.sub}>
          Here are the products available to you.
        </p>

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
              <ProductCard key={row.products.slug} product={row.products} />
            ))}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
