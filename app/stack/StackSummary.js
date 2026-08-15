'use client';

import { money, percent, multiple, irr } from './format';
import { FUNDING_STRATEGY } from '../../lib/stack/engine/inputs.js';
import styles from './stack.module.css';

/**
 * The appraisal summary (sub-step 2.3). The read-only review surface: the
 * verdict, the headline, the return metrics in three views, the partnership
 * split for a joint venture, the sources and uses, and the credit, margin and
 * residual land value. Every figure comes straight from the engine result.
 */

const DECISION_CLASS = {
  GO: styles['decision--go'],
  CONSIDER: styles['decision--consider'],
  'NO GO': styles['decision--nogo'],
};

function Card({ title, children }) {
  return (
    <section className={styles.card}>
      {title && <h3 className={styles.cardTitle}>{title}</h3>}
      {children}
    </section>
  );
}

// A label / value pair for the credit and margin lists.
function Line({ label, value }) {
  return (
    <div className={styles.line}>
      <span className={styles.lineLabel}>{label}</span>
      <span className={`${styles.lineValue} tnum`}>{value}</span>
    </div>
  );
}

const USES_LABELS = {
  landAtValue: 'Land (at value)',
  sdlt: 'SDLT',
  construction: 'Construction',
  professionalFees: 'Professional fees',
  statutory: 'Statutory',
  acquisitionLegal: 'Acquisition and legal',
  devManagementFee: 'Development management fee',
};

const SOURCES_LABELS = {
  seniorDebt: 'Senior debt',
  mezzanine: 'Mezzanine',
  presaleReceipts: 'Pre-sale receipts',
  sponsorEquity: 'Sponsor equity',
  partnerEquity: 'Funding partner equity',
  contributedLand: 'Contributed land',
};

export default function StackSummary({ result, meta }) {
  const currency = meta.currency;
  const { returns, decision, waterfall, sourcesAndUses, funding } = result;
  const inputs = meta.inputs;
  const isJv = meta.strategy === FUNDING_STRATEGY.JOINT_VENTURE;

  const returnViews = [
    { label: 'Project', hint: 'unlevered', irr: returns.project.irr, mult: returns.project.multiple, profit: returns.project.profit },
    { label: 'Equity', hint: 'levered', irr: returns.equity.irr, mult: returns.equity.multiple, profit: returns.equity.profit },
    { label: 'After tax', hint: 'equity', irr: returns.afterTax.irr, mult: returns.afterTax.multiple, profit: returns.afterTax.profit },
  ];

  const parties = [
    { label: 'Sponsor', ...waterfall.parties.sponsor, irr: returns.perParty.sponsorIrr },
    { label: 'Funding partner', ...waterfall.parties.partner, irr: returns.perParty.partnerIrr },
    { label: 'Landowner', ...waterfall.parties.landowner, irr: returns.perParty.landownerIrr },
  ];

  const usesLines = Object.entries(USES_LABELS)
    .filter(([key]) => sourcesAndUses.uses[key] > 0)
    .map(([key, label]) => ({ label, value: money(sourcesAndUses.uses[key], currency) }));
  const sourcesLines = Object.entries(SOURCES_LABELS)
    .filter(([key]) => sourcesAndUses.sources[key] > 0)
    .map(([key, label]) => ({ label, value: money(sourcesAndUses.sources[key], currency) }));

  const seniorFacility = funding.totals.seniorFacilityLimit;
  const totalCost = funding.totals.totalProjectCost;
  const rlvHeadroom = returns.residualLandValue - inputs.landValue;

  return (
    <div className={styles.summary} aria-live="polite">
      {/* Verdict */}
      <Card>
        <span className={`${styles.decision} ${DECISION_CLASS[decision.decision]}`}>
          {decision.decision}
        </span>
        <div className={styles.figures}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Project profit</span>
            <span className={`${styles.figureValue} tnum`}>{money(returns.projectProfit, currency)}</span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Profit on cost</span>
            <span className={`${styles.figureValue} tnum`}>{percent(returns.profitOnCost)}</span>
          </div>
        </div>
        <p className={styles.verdict}>{result.verdict}</p>
      </Card>

      {/* Return metrics */}
      <Card title="Return metrics">
        <div className={styles.tableScroll}>
          <table className={styles.metricTable}>
            <thead>
              <tr>
                <th scope="col">View</th>
                <th scope="col">IRR</th>
                <th scope="col">Multiple</th>
                <th scope="col">Profit</th>
              </tr>
            </thead>
            <tbody>
              {returnViews.map((row) => (
                <tr key={row.label}>
                  <th scope="row">
                    {row.label} <span className={styles.rowHint}>{row.hint}</span>
                  </th>
                  <td className="tnum">{irr(row.irr)}</td>
                  <td className="tnum">{multiple(row.mult)}</td>
                  <td className="tnum">{money(row.profit, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Partnership (JV only) */}
      {isJv && (
        <Card title="Partnership">
          <div className={styles.tableScroll}>
            <table className={styles.metricTable}>
              <thead>
                <tr>
                  <th scope="col">Party</th>
                  <th scope="col">In</th>
                  <th scope="col">Out</th>
                  <th scope="col">Profit</th>
                  <th scope="col">Multiple</th>
                  <th scope="col">IRR</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p) => (
                  <tr key={p.label}>
                    <th scope="row">{p.label}</th>
                    <td className="tnum">{money(p.capital, currency)}</td>
                    <td className="tnum">{money(p.cash, currency)}</td>
                    <td className="tnum">{money(p.profit, currency)}</td>
                    <td className="tnum">{multiple(p.multiple)}</td>
                    <td className="tnum">{irr(p.irr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sources and uses */}
      <Card title="Sources and uses">
        <div className={styles.twoCol}>
          <div>
            <h4 className={styles.subhead}>Uses</h4>
            {usesLines.map((l) => (
              <Line key={l.label} label={l.label} value={l.value} />
            ))}
            <Line label="Total" value={money(sourcesAndUses.uses.total, currency)} />
          </div>
          <div>
            <h4 className={styles.subhead}>Sources</h4>
            {sourcesLines.map((l) => (
              <Line key={l.label} label={l.label} value={l.value} />
            ))}
            <Line label="Total" value={money(sourcesAndUses.sources.total, currency)} />
          </div>
        </div>
      </Card>

      {/* Credit, margin and land */}
      <Card title="Credit and margin">
        <div className={styles.twoCol}>
          <div>
            {funding.totals.seniorFacilityLimit > 0 && (
              <>
                <Line label="Senior loan to cost" value={percent(seniorFacility / totalCost)} />
                <Line label="Senior loan to GDV" value={percent(seniorFacility / inputs.gdv)} />
                <Line label="Peak senior exposure" value={money(funding.peakSeniorDebt, currency)} />
              </>
            )}
            <Line label="Finance cost" value={money(funding.totalFinanceCost, currency)} />
            <Line label="Profit on GDV" value={percent(returns.profitOnGdv)} />
          </div>
          <div>
            <Line label="Residual land value" value={money(returns.residualLandValue, currency)} />
            <Line label="Headroom vs current land" value={money(rlvHeadroom, currency)} />
            <Line label="GDV can fall to break even" value={percent(returns.breakEven.gdvFallToBreakEven)} />
            <Line label="Cost can overrun to break even" value={percent(returns.breakEven.costOverrunToBreakEven)} />
          </div>
        </div>
      </Card>
    </div>
  );
}
