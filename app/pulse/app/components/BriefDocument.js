import { Fragment } from 'react';
import {
  SECTION_ORDER,
  SECTION_META,
  LENS_NOTE,
  showsProjected,
} from './briefLens';
import styles from './Brief.module.css';

/**
 * BriefDocument, the presentational PULSE Brief.
 *
 * Pure and stateless: it renders a `model` (from assembleBrief, or a locked
 * snapshot of one) under a `lens`, with a `lockState` for the header chips
 * and footer. The lens drives three things at render: section order
 * (SECTION_ORDER), which executive summary shows (model.summariesByLens),
 * and which financial figures are visible (showsProjected). The same model
 * serves all three lenses, so the locked snapshot is lens-independent and
 * the selector keeps working on a locked brief.
 *
 * Sections with no content for the project (no risks, no milestones, an
 * empty financials block for the lens) are dropped, and the remaining
 * sections are numbered by display order, so the document always reads
 * 01, 02, 03 in sequence regardless of lens.
 */

const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 3 };

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Only treat http(s) links as navigable. Anything else (a javascript: URL, a
// relative path, junk) renders as muted text, never as a live link.
function safeUrl(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

// Full date for the "Generated" chip, e.g. "31 May 2026". Runs client-side.
function formatLongDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Severity backdrop for a matrix cell: a standard symmetric heat scale by
// the sum of impact and likelihood (lo <= 3, md = 4, hi >= 5). The pins and
// the critical flags carry the real signal; this is only a backdrop.
function cellSeverityClass(impact, likelihood) {
  const sum = (SEVERITY_WEIGHT[impact] ?? 0) + (SEVERITY_WEIGHT[likelihood] ?? 0);
  if (sum <= 3) return styles.cellLo;
  if (sum === 4) return styles.cellMd;
  return styles.cellHi;
}

function HeaderChips({ lockState, stageLabel }) {
  const { locked, version, generatedAt } = lockState;
  const generated = formatLongDate(generatedAt);

  if (locked) {
    return (
      <div className={styles.meta}>
        <span className={`${styles.chip} ${styles.chipLock}`}>Baseline locked</span>
        {version != null && <span className={styles.chip}>Version {version}</span>}
        {generated && <span className={styles.chip}>Generated {generated}</span>}
        <span className={styles.chip}>{stageLabel}</span>
      </div>
    );
  }

  return (
    <div className={styles.meta}>
      <span className={styles.chip}>
        {version != null ? `Unlocked, was version ${version}` : 'Draft, not yet locked'}
      </span>
      <span className={styles.chip}>{stageLabel}</span>
    </div>
  );
}

function Summary({ model, lens }) {
  const paras = model.summariesByLens[lens] ?? [];
  return (
    <div className={styles.summary}>
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function ObjectiveCard({ obj, kind }) {
  const isNn = kind === 'nn';
  return (
    <div
      className={`${styles.objCard} ${isNn ? styles.objCardNn : styles.objCardFx}`}
    >
      <div className={styles.objTop}>
        <span className={styles.objRank}>{obj.rank}</span>
        <span className={styles.objName}>{obj.name}</span>
      </div>
      {obj.definition ? (
        <div className={styles.objDef}>{obj.definition}</div>
      ) : (
        <div className={`${styles.objDef} ${styles.objDefMuted}`}>
          Not yet defined.
        </div>
      )}
      {!isNn && obj.tolerance && (
        <div className={styles.objTol}>
          <b>Tolerance:</b> {obj.tolerance}
        </div>
      )}
    </div>
  );
}

function Objectives({ model }) {
  const { protected: prot, flexible } = model.objectives;
  return (
    <div className={styles.objSplit}>
      <div>
        <div className={styles.objColTitle}>
          <span className={`${styles.tag} ${styles.tagNn}`}>Protected</span>
          Will not be compromised
        </div>
        {prot.length > 0 ? (
          prot.map((o) => <ObjectiveCard key={o.name} obj={o} kind="nn" />)
        ) : (
          <p className={styles.objDefMuted}>
            No objective is marked non-negotiable.
          </p>
        )}
      </div>
      <div>
        <div className={styles.objColTitle}>
          <span className={`${styles.tag} ${styles.tagFx}`}>Has flex</span>
          Can move within bounds
        </div>
        {flexible.length > 0 ? (
          flexible.map((o) => <ObjectiveCard key={o.name} obj={o} kind="fx" />)
        ) : (
          <p className={styles.objDefMuted}>Every objective is protected.</p>
        )}
      </div>
    </div>
  );
}

function Read({ model }) {
  return (
    <div className={styles.read}>
      {model.insights.map((ins) => (
        <div
          key={ins.n}
          className={`${styles.insight} ${ins.tone === 'warn' ? styles.insightWarn : ''}`}
        >
          <div className={styles.iBadge}>{ins.n}</div>
          <div>
            <div className={styles.iTitle}>{ins.title}</div>
            <div className={styles.iBody}>{ins.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskMatrix({ matrix }) {
  const { cells, likelihoods, impacts } = matrix;
  return (
    <div className={styles.matrix} role="img" aria-label="Risk likelihood and impact matrix">
      <div />
      {likelihoods.map((l) => (
        <div key={l} className={styles.axisLabel}>
          {cap(l)}
        </div>
      ))}
      {impacts.map((imp) => (
        <Fragment key={imp}>
          <div className={styles.rowLabel}>{cap(imp)} impact</div>
          {likelihoods.map((lik) => {
            const key = `${imp}-${lik}`;
            return (
              <div
                key={key}
                className={`${styles.cell} ${cellSeverityClass(imp, lik)}`}
              >
                {cells[key].map((p) => (
                  <span
                    key={p.num}
                    className={`${styles.pin} ${p.critical ? styles.pinCrit : ''}`}
                  >
                    {p.num}
                  </span>
                ))}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function Risk({ model }) {
  const { list, matrix } = model.risks;
  const showMatrix = matrix.hasRated;
  return (
    <div
      className={`${styles.riskWrap} ${showMatrix ? '' : styles.riskWrapNoMatrix}`}
    >
      {showMatrix && <RiskMatrix matrix={matrix} />}
      <div className={styles.riskList}>
        {list.map((r) => (
          <div key={r.num} className={styles.riskRow}>
            <span
              className={`${styles.rNum} ${r.critical ? styles.rNumCrit : ''}`}
            >
              {r.num}
            </span>
            <div className={styles.rText}>
              <span className={styles.rt}>{r.description}</span>
              {r.critical && (
                <span className={styles.critFlag}>
                  {r.servesName ? `Critical, vs ${r.servesName}` : 'Critical'}
                </span>
              )}
              {r.mitigation && (
                <div className={styles.rMeta}>Mitigation: {r.mitigation}</div>
              )}
              {!r.rated && (
                <div className={`${styles.rMeta} ${styles.rUnrated}`}>
                  Likelihood or impact not yet rated.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Programme({ model }) {
  return (
    <div className={styles.timeline}>
      {model.milestones.map((m, i) => (
        <div key={i} className={styles.ms}>
          <span
            className={`${styles.msMarker} ${m.critical ? styles.msMarkerCrit : ''}`}
          />
          <span
            className={`${styles.msWhen} ${m.dateDisplay ? '' : styles.msWhenTbc}`}
          >
            {m.dateDisplay ?? 'Date to set'}
          </span>
          <span className={styles.msWhat}>
            {m.name}
            {m.critical && <span className={styles.msFlag}>Critical</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Workstreams({ model }) {
  return (
    <div className={styles.wsGrid}>
      {model.workstreams.map((w, i) => {
        const tailParts = [
          w.critical ? 'Critical' : null,
          w.servesName ? `serves ${w.servesName}` : null,
        ].filter(Boolean);
        const tail = tailParts.join(', ');
        return (
          <div
            key={i}
            className={`${styles.wsCard} ${w.critical ? styles.wsCardCrit : ''}`}
          >
            <div className={styles.wsName}>{w.name}</div>
            <div className={styles.wsLead}>
              {w.lead ? (
                <>
                  <b>Lead:</b> {w.lead}.{' '}
                </>
              ) : (
                <>Lead to be assigned. </>
              )}
              {tail && <>{cap(tail)}.</>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Financials({ model, lens }) {
  const f = model.financials;
  const proj = showsProjected(lens);

  // Budget (allotted) lives in the KPI strip (non-gated, all lenses). This
  // block carries only the gated projected figures and the appraisal link,
  // so it is empty for the Design Consultant and the section drops out.
  const tiles = [];
  if (proj && f.projectedGdv.present) {
    tiles.push({ k: 'Projected GDV', v: f.projectedGdv.display });
  }
  if (proj && f.projectedRoi.present) {
    tiles.push({ k: 'Projected ROI', v: f.projectedRoi.display });
  }

  const showsAnyProjected =
    proj && (f.projectedGdv.present || f.projectedRoi.present);
  const safe = proj ? safeUrl(f.detailUrl) : null;

  return (
    <>
      {tiles.length > 0 && (
        <div className={styles.finGrid}>
          {tiles.map((t) => (
            <div key={t.k} className={styles.finTile}>
              <div className={styles.finKey}>{t.k}</div>
              <div className={styles.finVal}>{t.v}</div>
            </div>
          ))}
        </div>
      )}
      {showsAnyProjected && (
        <p className={styles.finNote}>
          Projected figures are the developer&apos;s estimates, not committed
          values. PULSE presents them and does not model them.
        </p>
      )}
      {proj &&
        (safe ? (
          <a
            className={styles.finLink}
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full financial appraisal
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M4 10l6-6M5 4h5v5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ) : (
          <p className={styles.finLinkMuted}>Full appraisal not yet linked.</p>
        ))}
    </>
  );
}

const SECTION_RENDERERS = {
  summary: (model, lens) => <Summary model={model} lens={lens} />,
  objectives: (model) => <Objectives model={model} />,
  read: (model) => <Read model={model} />,
  risk: (model) => <Risk model={model} />,
  programme: (model) => <Programme model={model} />,
  ws: (model) => <Workstreams model={model} />,
  funding: (model, lens) => <Financials model={model} lens={lens} />,
};

// Whether a section has anything to render for this project and lens.
function sectionHasContent(key, model, lens) {
  switch (key) {
    case 'summary':
      return (model.summariesByLens[lens] ?? []).length > 0;
    case 'objectives':
      return true;
    case 'read':
      return model.insights.length > 0;
    case 'risk':
      return model.risks.list.length > 0;
    case 'programme':
      return model.milestones.length > 0;
    case 'ws':
      return model.workstreams.length > 0;
    case 'funding': {
      // Budget shows in the KPI strip, not here; this section is the gated
      // projected figures and the link, so it is Lender/JV only.
      const f = model.financials;
      return (
        showsProjected(lens) &&
        (f.projectedGdv.present || f.projectedRoi.present || !!f.detailUrl)
      );
    }
    default:
      return false;
  }
}

export default function BriefDocument({ model, lens, lockState }) {
  const order = SECTION_ORDER[lens] ?? SECTION_ORDER.lender;
  const visible = order.filter((key) => sectionHasContent(key, model, lens));

  return (
    <div className={styles.doc}>
      <div className={styles.docHead}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            P
          </span>
          <span className={styles.brandName}>PULSE</span>
        </div>
        <div className={styles.eyebrow}>Project Initiation Brief</div>
        <h2 className={styles.docTitle}>{model.identity.name}</h2>
        {model.identity.subtitle && (
          <div className={styles.docSub}>{model.identity.subtitle}</div>
        )}
        <HeaderChips lockState={lockState} stageLabel={model.identity.stageLabel} />
      </div>

      <div className={styles.lensNote}>{LENS_NOTE[lens]}</div>

      <div className={styles.kpis}>
        {model.kpis.map((k) => (
          <div key={k.key} className={styles.kpi}>
            <div className={styles.kpiLabel}>{k.label}</div>
            <div className={styles.kpiValue}>
              {k.value != null && k.value !== '' ? (
                k.value
              ) : (
                <span className={styles.kpiEmpty}>Not set</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        {visible.map((key, i) => {
          const meta = SECTION_META[key];
          return (
            <section key={key} className={styles.section}>
              <div className={styles.secHead}>
                <span className={styles.secNum}>{pad2(i + 1)}</span>
                <h3 className={styles.secTitle}>{meta.title}</h3>
                {meta.subtitle && <span className={styles.secSub}>{meta.subtitle}</span>}
              </div>
              {SECTION_RENDERERS[key](model, lens)}
            </section>
          );
        })}
      </div>

      <div className={styles.docFoot}>
        <div className={styles.meth}>
          Built on <b>The PULSE Framework</b>. Objectives are classified by how
          much each can flex before the project is compromised, and that
          classification cascades to milestones, risks and workstreams. This is
          the version-locked baseline against which every later stage is
          measured.
        </div>
        <div className={styles.ver}>
          {lockState.locked ? `v${lockState.version} Locked` : 'Draft'}
        </div>
      </div>
    </div>
  );
}
