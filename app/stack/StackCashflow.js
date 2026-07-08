'use client';

import { money } from './format';
import styles from './stack.module.css';

/**
 * The cashflow view (sub-step 2.4). Costs by phase down the side, the calendar
 * months across from the commencement date. The net movement and the cumulative
 * position run along the bottom; the cumulative is the funding requirement, and
 * it ends at the project profit. Wide, so it scrolls sideways on a narrow screen
 * with the phase column pinned.
 */

const PHASES = [
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'design', label: 'Design and pre-construction' },
  { key: 'construction', label: 'Construction' },
  { key: 'finance', label: 'Finance' },
  { key: 'sales', label: 'Sales' },
];

// A compact cell: blank for a zero, a rounded number with thousands separators
// otherwise. The currency is stated once in the card note, not per cell.
function cell(value) {
  if (Math.abs(value) < 0.5) return '';
  return Math.round(value).toLocaleString('en-GB');
}

// The calendar label for a month offset from the commencement date.
function monthLabel(commencementISO, offset) {
  const date = new Date(`${commencementISO}T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export default function StackCashflow({ result, meta }) {
  const { rows, peakFunding } = result.cashflow;
  const currency = meta.currency;
  const commencement = meta.commencementDate;

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Cashflow</h3>
      <p className={styles.cardNote}>
        Costs by phase and the sale across the calendar. The cumulative position is the funding
        requirement, ending at the project profit. All amounts in {currency}.
      </p>

      <div className={styles.figures}>
        <div className={styles.figure}>
          <span className={styles.figureLabel}>Peak funding requirement</span>
          <span className={`${styles.figureValue} tnum`}>{money(peakFunding, currency)}</span>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.cashflowTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.stickyCol}>
                Phase
              </th>
              {rows.map((row, idx) => (
                <th key={row.month} scope="col">
                  {monthLabel(commencement, idx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PHASES.map((phase) => (
              <tr key={phase.key}>
                <th scope="row" className={styles.stickyCol}>
                  {phase.label}
                </th>
                {rows.map((row) => (
                  <td key={row.month} className="tnum">
                    {cell(row[phase.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className={styles.cashflowStrong}>
              <th scope="row" className={styles.stickyCol}>
                Net movement
              </th>
              {rows.map((row) => (
                <td key={row.month} className="tnum">
                  {cell(row.netMovement)}
                </td>
              ))}
            </tr>
            <tr className={styles.cashflowStrong}>
              <th scope="row" className={styles.stickyCol}>
                Cumulative position
              </th>
              {rows.map((row) => (
                <td key={row.month} className="tnum">
                  {cell(row.cumulative)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
