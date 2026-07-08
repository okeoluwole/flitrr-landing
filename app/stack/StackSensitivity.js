'use client';

import { percent, multiple } from './format';
import { FUNDING_STRATEGY } from '../../lib/stack/engine/inputs.js';
import styles from './stack.module.css';

/**
 * The sensitivity view (sub-step 2.6). Two grids that re-derive live. The
 * viability grid shows how profit on cost moves as GDV and build cost move, each
 * cell shaded by the same go / consider / no-go language as the verdict. The
 * joint venture grid shows how the sponsor multiple moves as the preferred
 * return and the promote move. Both scroll sideways on a narrow screen.
 */

// A signed-percentage delta label, with the base run marked.
function delta(value) {
  if (value === 0) return 'Base';
  return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
}

function rate(value) {
  return `${Math.round(value * 100)}%`;
}

// The go / consider / no-go class for a profit on cost, matching the verdict.
function pocClass(poc, target, band) {
  if (poc >= target) return styles['cell--go'];
  if (poc >= target - band) return styles['cell--consider'];
  return styles['cell--nogo'];
}

function Grid({ title, note, colHeader, rowHeader, cols, rows, grid, renderCell, baseRow, baseCol }) {
  return (
    <div className={styles.grid2}>
      <h4 className={styles.subhead}>{title}</h4>
      {note && <p className={styles.gridNote}>{note}</p>}
      <div className={styles.tableScroll}>
        <table className={styles.gridTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.gridCorner}>
                {rowHeader} \ {colHeader}
              </th>
              {cols.map((c, j) => (
                <th key={j} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">{r}</th>
                {grid[i].map((value, j) => {
                  const isBase = i === baseRow && j === baseCol;
                  return (
                    <td key={j} className={`tnum ${renderCell(value).className} ${isBase ? styles.cellBase : ''}`}>
                      {renderCell(value).text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StackSensitivity({ result, meta }) {
  const { viability, jvTerms } = result.sensitivity;
  const target = meta.inputs.targetProfitOnCost;
  const band = meta.inputs.considerBand;
  const isJv = meta.strategy === FUNDING_STRATEGY.JOINT_VENTURE;

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Sensitivity</h3>

      <Grid
        title="Scheme viability"
        note="Profit on cost as GDV (across) and build cost (down) move, coloured go, consider or no-go."
        colHeader="GDV"
        rowHeader="Build"
        cols={viability.gdvDeltas.map(delta)}
        rows={viability.buildDeltas.map(delta)}
        grid={viability.grid}
        baseRow={viability.buildDeltas.indexOf(0)}
        baseCol={viability.gdvDeltas.indexOf(0)}
        renderCell={(value) => ({ text: percent(value), className: pocClass(value, target, band) })}
      />

      {isJv && (
        <Grid
          title="Joint venture deal terms"
          note="Sponsor return multiple as the preferred return (down) and the promote (across) move."
          colHeader="Promote"
          rowHeader="Pref"
          cols={jvTerms.promoteShares.map(rate)}
          rows={jvTerms.prefRates.map(rate)}
          grid={jvTerms.grid}
          baseRow={jvTerms.prefRates.indexOf(0.1)}
          baseCol={jvTerms.promoteShares.indexOf(0.5)}
          renderCell={(value) => ({ text: multiple(value), className: '' })}
        />
      )}
    </section>
  );
}
