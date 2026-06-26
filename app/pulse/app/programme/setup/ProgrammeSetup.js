'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PROGRAMME_TEMPLATE } from '../../../../../lib/engine/programmeTemplate.js';
import { deriveRealityCheck } from '../../../../../lib/engine/programmeRealityCheck.js';
import { OBJECTIVE_META } from '../../components/objectiveMeta';
import {
  RECONCILE_DECISIONS,
  flaggedItems,
  allowedDecisions,
  agreedDate,
  canProceed,
  initialDecisions,
  reconcileSummary,
  buildResolutions,
} from './reconcileModel';
import styles from './ProgrammeSetup.module.css';

/**
 * ProgrammeSetup - the Programme set-up flow's entry (Phase 1.2).
 *
 * The page (server) has loaded the locked programme and passes plain inputs in:
 * the project start date (from the Brief) and the developer's hand-set
 * programme choices (loadProgrammeChoices). This client runs the reality-check
 * engine over them and either lands the developer on the reconcile-dates screen
 * (when a date is flagged) or skips it entirely (when nothing is flagged),
 * exactly as the specification's set-up step 3 prescribes.
 *
 * It writes nothing. The reconcile decisions are held in this flow's state and,
 * on proceed, become the resolution set the later assembly and lock steps (2.1
 * and 2.3) will apply. v1 is produced at lock, in Phase 2, not here, so the
 * step after reconcile is a placeholder for now.
 */

const { ACCEPTED, KEPT, VERIFIED } = RECONCILE_DECISIONS;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Map a served-objective identifier (the template's lowercase objective_type)
// to its human label, so a milestone row can read "serves Time".
const OBJECTIVE_NAME = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The served objective per milestone, keyed by the milestone's stable key, read
// straight from the template. Deterministic, not invented at render time.
const SERVES_BY_KEY = (() => {
  const map = {};
  for (const stage of PROGRAMME_TEMPLATE.stages) {
    for (const activity of stage.activities ?? []) {
      for (const m of activity.milestones ?? []) map[m.key] = m.serves;
    }
  }
  return map;
})();

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// A plain-language gap between the developer's date and the recommendation, in
// whole weeks. The engine works in weeks, so the unit stays coherent with the
// reasons. Positive means the recommendation falls later, negative earlier.
function deltaLabel(developerDate, recommendedDate) {
  if (!(developerDate instanceof Date) || !(recommendedDate instanceof Date)) {
    return null;
  }
  const weeks = Math.round(
    (recommendedDate.getTime() - developerDate.getTime()) / MS_PER_WEEK
  );
  if (weeks === 0) return 'about the same';
  const n = Math.abs(weeks);
  const unit = n === 1 ? 'week' : 'weeks';
  return `${n} ${unit} ${weeks > 0 ? 'later' : 'earlier'}`;
}

const KIND_LABEL = { gate: 'Gate', milestone: 'Milestone' };

const TIER_CHIP = {
  propose: 'Tight against typical',
  force: 'Below a hard floor',
  flag_verify: 'Verify locally',
};

const DECISION_SUMMARY = {
  [ACCEPTED]: 'Accepted the recommendation',
  [KEPT]: 'Kept your date',
  [VERIFIED]: 'Verified locally',
};

// One date box: a label and a tabular date value.
function DateBox({ label, date, recommended }) {
  return (
    <div className={`${styles.datebox} ${recommended ? styles.dateboxRec : ''}`}>
      <span className={styles.dateLabel}>{label}</span>
      <span className={styles.dateValue}>{formatDate(date) ?? 'Not set'}</span>
    </div>
  );
}

// The dates block: the developer's date against the recommended date where one
// exists, with the gap between them. flag_verify carries no recommendation, so
// only the developer's date shows.
function DatesBlock({ item }) {
  const delta = item.recommendedDate
    ? deltaLabel(item.developerDate, item.recommendedDate)
    : null;
  return (
    <div className={styles.dates}>
      <DateBox label="Your date" date={item.developerDate} />
      {item.recommendedDate && (
        <>
          {delta && <span className={styles.delta}>{delta}</span>}
          <DateBox label="Recommended" date={item.recommendedDate} recommended />
        </>
      )}
    </div>
  );
}

// The propose controls: accept or keep, presented evenly with no default. Keep
// reveals a required reason, because a kept divergence is recorded as a risk.
function ProposeControls({ item, state, onDecide, onNote }) {
  const acceptLabel = formatDate(item.recommendedDate);
  const keepLabel = formatDate(item.developerDate);
  return (
    <div className={styles.controls}>
      <div className={styles.choices} role="group" aria-label="Choose a date">
        <button
          type="button"
          className={`${styles.choice} ${state.decision === ACCEPTED ? styles.choiceSelected : ''}`}
          aria-pressed={state.decision === ACCEPTED}
          onClick={() => onDecide(ACCEPTED)}
        >
          <span className={styles.choiceLead}>Accept the recommendation</span>
          <span className={styles.choiceSub}>{acceptLabel}</span>
        </button>
        <button
          type="button"
          className={`${styles.choice} ${state.decision === KEPT ? styles.choiceSelected : ''}`}
          aria-pressed={state.decision === KEPT}
          onClick={() => onDecide(KEPT)}
        >
          <span className={styles.choiceLead}>Keep your date</span>
          <span className={styles.choiceSub}>{keepLabel}</span>
        </button>
      </div>
      {state.decision === KEPT && (
        <label className={styles.reasonField}>
          <span className={styles.reasonLabel}>
            Why are you holding this date?
            <span className={styles.reasonRequired}> Required</span>
          </span>
          <textarea
            className={styles.reasonInput}
            rows={2}
            value={state.note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="This will be recorded as a risk on the log."
          />
        </label>
      )}
    </div>
  );
}

// The force controls: accept only. A breached hard floor cannot be kept and
// must be corrected, so there is a single accept and a plain statement of why.
function ForceControls({ item, state, onDecide }) {
  const acceptLabel = formatDate(item.recommendedDate);
  return (
    <div className={styles.controls}>
      <p className={styles.forceNote}>
        This date falls below a confirmed requirement, so it cannot be kept. Move
        it to the compliant date to continue.
      </p>
      <button
        type="button"
        className={`${styles.choice} ${styles.choiceForce} ${state.decision === ACCEPTED ? styles.choiceSelected : ''}`}
        aria-pressed={state.decision === ACCEPTED}
        onClick={() => onDecide(ACCEPTED)}
      >
        <span className={styles.choiceLead}>Move to the compliant date</span>
        <span className={styles.choiceSub}>{acceptLabel}</span>
      </button>
    </div>
  );
}

// The flag_verify controls: acknowledge you have checked the date against your
// jurisdiction. It keeps your own date, takes an optional note, and never blocks
// like a force does.
function VerifyControls({ state, onDecide, onNote }) {
  const acknowledged = state.decision === VERIFIED;
  return (
    <div className={styles.controls}>
      <label className={styles.verifyCheck}>
        <input
          type="checkbox"
          className={styles.verifyBox}
          checked={acknowledged}
          onChange={(e) => onDecide(e.target.checked ? VERIFIED : null)}
        />
        <span className={styles.verifyLabel}>
          I have checked this date against my jurisdiction.
        </span>
      </label>
      {acknowledged && (
        <label className={styles.reasonField}>
          <span className={styles.reasonLabel}>
            Note
            <span className={styles.reasonOptional}> Optional</span>
          </span>
          <textarea
            className={styles.reasonInput}
            rows={2}
            value={state.note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="For example, the determination period you confirmed."
          />
        </label>
      )}
    </div>
  );
}

// One flagged item as a card: its identity, its dates, the reason, and the
// tier's decision controls.
function ReconcileCard({ item, state, onDecide, onNote }) {
  const isForce = item.tier === 'force';
  const kindLabel = KIND_LABEL[item.kind] ?? item.kind;
  const servesType = item.kind === 'milestone' ? SERVES_BY_KEY[item.key] : null;
  const servesName = servesType ? OBJECTIVE_NAME[servesType] : null;

  return (
    <article className={`${styles.card} ${isForce ? styles.cardCritical : ''}`}>
      <div className={styles.cardTop}>
        <div>
          <h2 className={styles.cardName}>{item.name}</h2>
          <p className={styles.cardMeta}>
            {kindLabel} · Stage {item.stage}
            {servesName ? ` · serves ${servesName}` : ''}
          </p>
        </div>
        <span
          className={`${styles.tierChip} ${isForce ? styles.tierChipCritical : ''}`}
        >
          {TIER_CHIP[item.tier] ?? item.tier}
        </span>
      </div>

      <DatesBlock item={item} />

      {item.reason && <p className={styles.why}>{item.reason}</p>}

      {item.tier === 'propose' && (
        <ProposeControls
          item={item}
          state={state}
          onDecide={onDecide}
          onNote={onNote}
        />
      )}
      {item.tier === 'force' && (
        <ForceControls item={item} state={state} onDecide={onDecide} />
      )}
      {item.tier === 'flag_verify' && (
        <VerifyControls state={state} onDecide={onDecide} onNote={onNote} />
      )}
    </article>
  );
}

export default function ProgrammeSetup({
  projectName,
  workspaceHref,
  projectStart,
  choices,
}) {
  // The reality check, run once over the loaded inputs. Pure and deterministic.
  const realityCheck = useMemo(
    () => deriveRealityCheck(projectStart, PROGRAMME_TEMPLATE, choices),
    [projectStart, choices]
  );
  const flagged = useMemo(() => flaggedItems(realityCheck), [realityCheck]);
  const summary = useMemo(() => reconcileSummary(realityCheck), [realityCheck]);

  const [decisions, setDecisions] = useState(() =>
    initialDecisions(realityCheck)
  );
  // When nothing is flagged the reconcile step is skipped: the flow lands
  // straight on the assemble placeholder, with an empty resolution set.
  const [phase, setPhase] = useState(
    realityCheck.anyFlagged ? 'reconcile' : 'assemble'
  );
  const [resolutions, setResolutions] = useState(
    realityCheck.anyFlagged ? null : []
  );

  const setDecision = (key, decision) =>
    setDecisions((prev) => ({
      ...prev,
      [key]: { ...prev[key], decision },
    }));
  const setNote = (key, note) =>
    setDecisions((prev) => ({
      ...prev,
      [key]: { ...prev[key], note },
    }));

  const ready = canProceed(realityCheck, decisions);

  const handleProceed = () => {
    if (!ready) return;
    setResolutions(buildResolutions(realityCheck, decisions));
    setPhase('assemble');
  };

  const Header = (
    <>
      <Link href={workspaceHref} className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M9 11L5 7l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to the workspace
      </Link>
      <p className={styles.eyebrow}>Programme / Set up</p>
      <h1 className={styles.title}>Reconcile dates</h1>
      <p className={styles.projectName}>{projectName}</p>
      <div className={styles.steps} aria-hidden="true">
        <span className={phase === 'reconcile' ? styles.stepOn : styles.stepDone}>
          1 Reconcile dates
        </span>
        <span className={styles.stepSep}>/</span>
        <span className={phase === 'assemble' ? styles.stepOn : styles.stepOff}>
          2 Review and lock
        </span>
      </div>
    </>
  );

  // ── The assemble placeholder: the skip landing, or the post-reconcile hand
  //    off. v1 assembly and lock are Phase 2; this step only holds the
  //    resolutions in state for them. ──
  if (phase === 'assemble') {
    const skipped = !realityCheck.anyFlagged;
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}
        <div className={`${styles.placeholder} riseIn`}>
          {skipped ? (
            <>
              <p className={styles.placeholderLead}>
                Every Brief date you set sits within its normal range. There is
                nothing to reconcile.
              </p>
              <p className={styles.placeholderText}>
                {summary.withinNorm > 0
                  ? `${summary.withinNorm} dated ${summary.withinNorm === 1 ? 'point' : 'points'} checked, all within range.`
                  : 'No dates needed checking.'}{' '}
                Set-up moves straight on to assembling the programme.
              </p>
            </>
          ) : (
            <>
              <p className={styles.placeholderLead}>
                Dates reconciled. Your decisions are held for the next step.
              </p>
              <ul className={styles.resList}>
                {resolutions.map((r) => (
                  <li key={r.key} className={styles.resItem}>
                    <span className={styles.resName}>
                      {KIND_LABEL[r.kind] ?? r.kind} · Stage {r.stage}
                    </span>
                    <span className={styles.resDecision}>
                      {DECISION_SUMMARY[r.decision] ?? r.decision}
                      {r.agreedDate ? `: ${formatDate(r.agreedDate)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.placeholderNext}>
            Next: assemble the two-level programme and lock it as v1. That step
            is built in Phase 2.
          </p>
          {!skipped && (
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => setPhase('reconcile')}
            >
              Back to reconcile
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── The reconcile screen: only the flagged dates, each as the developer's
  //    date against the recommendation, with the tier's decision. ──
  const flaggedCount = summary.flagged;
  return (
    <main className={`container ${styles.page}`} id="main-content">
      {Header}

      <p className={styles.lead}>
        <span className={styles.leadStrong}>
          {flaggedCount === 1
            ? 'One of your Brief dates needs'
            : `${flaggedCount} of your Brief dates need`}{' '}
          a decision
        </span>{' '}
        before set-up continues. Review each one below.
      </p>
      <p className={styles.subnote}>
        Keeping your own date is fine. It records a risk on the log, so the
        optimism is tracked, not hidden. The rest of your dates sit within
        normal ranges and are not shown here.
      </p>

      <div className={styles.cards}>
        {flagged.map((item) => (
          <ReconcileCard
            key={item.key}
            item={item}
            state={decisions[item.key]}
            onDecide={(decision) => setDecision(item.key, decision)}
            onNote={(note) => setNote(item.key, note)}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <p className={styles.footerSummary}>
          <span className={styles.tnum}>{summary.flagged}</span> flagged
          {' · '}
          <span className={styles.tnum}>{summary.withinNorm}</span> within range
          {' · '}
          {summary.force > 0
            ? 'a hard floor must be corrected'
            : 'no hard floors breached'}
        </p>
        <div className={styles.footerActions}>
          {!ready && (
            <span className={styles.proceedHint}>
              Decide every flagged date to continue.
            </span>
          )}
          <button
            type="button"
            className={styles.proceedBtn}
            onClick={handleProceed}
            disabled={!ready}
          >
            Assemble programme
          </button>
        </div>
      </div>
    </main>
  );
}
