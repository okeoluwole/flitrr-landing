'use client';

import { money, percent, multiple } from './format';
import styles from './stack.module.css';

/**
 * The funding comparison (sub-step 2.5). The same scheme funded five ways: four
 * closed-form estimates and the developer's own selected route, live from the
 * engine and the waterfall. Cash in and profit are the developer's slice, so on
 * a joint venture the profit is after the partner and landowner shares.
 */

export default function StackComparison({ result, meta }) {
  const c = result.comparison;
  const currency = meta.currency;

  const routes = [
    { label: 'Self-funded', route: c.selfFunded, note: 'Most cash in, no debt' },
    { label: 'Bank-financed', route: c.bankFinanced, note: 'Senior debt, less cash in' },
    { label: 'Mixed', route: c.mixed, note: 'Senior plus mezzanine' },
    { label: c.selected.strategy, route: c.selected, note: 'Your route, live', selected: true },
    { label: 'Off-plan', route: c.offPlan, note: 'Pre-sales fund the build' },
  ];

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>The same scheme, funded five ways</h3>
      <p className={styles.cardNote}>
        Cash in and profit are your slice. Your selected route is live from the engine; the others
        are like-for-like estimates.
      </p>

      <div className={styles.tableScroll}>
        <table className={styles.metricTable}>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Cash in</th>
              <th scope="col">Profit</th>
              <th scope="col">On cash</th>
              <th scope="col">PoC</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.label} className={r.selected ? styles.rowSelected : undefined}>
                <th scope="row">
                  {r.label}
                  {r.selected && <span className={styles.rowHint}> selected</span>}
                  <span className={styles.routeNote}>{r.note}</span>
                </th>
                <td className="tnum">{money(r.route.cashIn, currency)}</td>
                <td className="tnum">{money(r.route.profit, currency)}</td>
                <td className="tnum">{multiple(r.route.returnOnCash)}</td>
                <td className="tnum">{percent(r.route.profitOnCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
