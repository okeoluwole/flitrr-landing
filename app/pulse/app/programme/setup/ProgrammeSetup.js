'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../../lib/supabase/client';
import { PROGRAMME_TEMPLATE } from '../../../../../lib/engine/programmeTemplate.js';
import { deriveRealityCheck } from '../../../../../lib/engine/programmeRealityCheck.js';
import { assembleProgramme } from '../../../../../lib/engine/programmeAssembly.js';
import { OBJECTIVE_META } from '../../components/objectiveMeta';
import { writeProgrammeBaseline } from '../../components/programmeBaselineStore';
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
import {
  REVIEW_PHASES,
  initialReviewPhase,
  canReturnToReconcile,
  reviewStages,
  reviewSummary,
  lockEligibility,
  buildBaselineLockArgs,
  lockSucceeded,
} from './reviewLockModel';
import ViewOnlyBadge from '../../components/ViewOnlyBadge';
import styles from './ProgrammeSetup.module.css';

/**
 * ProgrammeSetup - the Programme set-up flow (Phase 1.2 reconcile, Phase 2.3
 * review and lock).
 *
 * The page (server) has loaded the locked programme and passes plain inputs in:
 * the project start date and the developer's hand-set programme choices, plus
 * the inputs the lock needs (the project, the objective rows for the criticality
 * join, the v0 provenance reference for the locked Brief, the current user, and
 * the current baseline if one already exists). This client runs the reality-check
 * engine and either lands the developer on the reconcile-dates screen (when a
 * date is flagged) or skips it (when nothing is flagged), then assembles the
 * agreed programme, shows it read-only, and on a confirmed lock writes v1 through
 * the store.
 *
 * The review is read-only: the reality check ran upstream, so no date is edited
 * here. The visibility filter (reviewLockModel.reviewStages) shows the gates and
 * the carried milestones the developer set; the added drill-down milestones lock
 * into v1 silently. The lock is deliberate and confirmed, states what it means,
 * and writes through programmeBaselineStore.writeProgrammeBaseline. This screen
 * locks v1 only: when a current baseline already exists it shows the already-
 * locked state rather than offering a second lock. A failed write surfaces the
 * failure and never claims the programme is locked.
 */

const { ACCEPTED, KEPT, VERIFIED } = RECONCILE_DECISIONS;

const LOCK_ERROR =
  'We could not lock the programme. Please check your connection and try again, or email hello@flitrr.com.';

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

// A longer date stamp for the locked record (a DB timestamp, an ISO string or a
// Date). Distinct from formatDate, which reads the assembled Date baseline dates.
function formatStamp(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// A compact date for a stage span, two-digit year to read at a glance.
function formatShort(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

// The stage span, the agreed stage start to the agreed gate date.
function formatRange(start, end) {
  const s = formatShort(start);
  const e = formatShort(end);
  if (!s && !e) return null;
  if (!s) return `to ${e}`;
  if (!e) return `from ${s}`;
  return `${s} to ${e}`;
}

function CheckIcon() {
  return (
    <svg
      className={styles.lockedTick}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// One carried milestone row: its marker, name, served objective, agreed date, and
// its baked criticality. The criticality is read from the assembled snapshot,
// never derived here.
function MilestoneRow({ milestone }) {
  const servesName = OBJECTIVE_NAME[milestone.serves] ?? null;
  const critical = milestone.criticality === 'critical';
  return (
    <div className={styles.item}>
      <span className={`${styles.mk} ${styles.mkMs}`} aria-hidden="true" />
      <span className={styles.iname}>{milestone.name}</span>
      <span className={styles.imeta}>
        {servesName ? `serves ${servesName}` : 'milestone'}
      </span>
      <span className={`${styles.idate} tnum`}>
        {formatDate(milestone.baselineDate) ?? ''}
      </span>
      <span className={critical ? styles.badgeCrit : styles.badgeStd}>
        {critical ? 'Critical' : 'Standard'}
      </span>
    </div>
  );
}

// The gate row that closes a stage. A gate carries no baked criticality, so it
// shows its date but no criticality badge it would have to invent.
function GateRow({ gate }) {
  return (
    <div className={`${styles.item} ${styles.itemGate}`}>
      <span className={`${styles.mk} ${styles.mkGate}`} aria-hidden="true" />
      <span className={styles.iname}>{gate.name}</span>
      <span className={styles.imeta}>gate</span>
      <span className={`${styles.idate} tnum`}>
        {formatDate(gate.baselineDate) ?? ''}
      </span>
    </div>
  );
}

// One stage in the review: its carried milestones in date order, then its gate.
// A not-applicable stage carries no dated points and reads plainly.
function ReviewStage({ stage }) {
  if (!stage.applicable) {
    return (
      <div className={`${styles.stageCard} ${styles.stageNa}`}>
        <div className={styles.stageHead}>
          <div className={styles.stageTitle}>
            <b>S{stage.stage}</b> {stage.name}
          </div>
          <span className={styles.stageNaTag}>Not applicable</span>
        </div>
      </div>
    );
  }
  const range = formatRange(stage.stageStart, stage.gate.baselineDate);
  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHead}>
        <div className={styles.stageTitle}>
          <b>S{stage.stage}</b> {stage.name}
        </div>
        {range && <span className={`${styles.stageDur} tnum`}>{range}</span>}
      </div>
      <div className={styles.items}>
        {stage.milestones.map((m) => (
          <MilestoneRow key={m.key} milestone={m} />
        ))}
        <GateRow gate={stage.gate} />
      </div>
    </div>
  );
}

// The locked record, shared by the post-lock confirmation and the already-locked
// re-entry. justLocked distinguishes the two only in its lead line.
function LockedPanel({ version, lockedAt, lockerName, justLocked, workspaceHref }) {
  const on = formatStamp(lockedAt);
  return (
    <div className={`${styles.lockedPanel} riseIn`}>
      <div className={styles.lockedBadge}>
        <CheckIcon />
        <span>Programme locked</span>
      </div>
      <p className={styles.lockedLead}>
        {justLocked
          ? 'This programme is locked as v1.'
          : 'This programme is already locked as v1.'}
      </p>
      <p className={styles.lockedMeta}>
        Version {version}
        {on ? `, locked on ${on}` : ''}
        {lockerName ? ` by ${lockerName}` : ''}.
      </p>
      <p className={styles.lockedNote}>
        It is the operational baseline your trackers read. Forecasts and actuals
        begin from here. Changing it later is an explicit, recorded re-baseline,
        never a silent drift.
      </p>
      <Link href={workspaceHref} className={styles.cta}>
        Back to the workspace
      </Link>
    </div>
  );
}

export default function ProgrammeSetup({
  projectName,
  workspaceHref,
  projectStart,
  choices,
  projectId,
  objectives,
  sourceBriefId,
  userId,
  lockerName,
  existingBaseline,
  canEdit = true,
  adminContact = null,
}) {
  // The reality check, run once over the loaded inputs. Pure and deterministic.
  const realityCheck = useMemo(
    () => deriveRealityCheck(projectStart, PROGRAMME_TEMPLATE, choices),
    [projectStart, choices]
  );
  const flagged = useMemo(() => flaggedItems(realityCheck), [realityCheck]);
  const summary = useMemo(() => reconcileSummary(realityCheck), [realityCheck]);

  const supabase = createClient();

  // This screen locks v1 only. When a current baseline already exists the lock is
  // not offered: the already-locked state is shown instead.
  const eligibility = lockEligibility(existingBaseline);

  const [decisions, setDecisions] = useState(() =>
    initialDecisions(realityCheck)
  );
  // When nothing is flagged the reconcile step is skipped: the flow opens straight
  // on the review, with an empty resolution set.
  const [phase, setPhase] = useState(() =>
    initialReviewPhase(realityCheck.anyFlagged)
  );
  const [resolutions, setResolutions] = useState(
    realityCheck.anyFlagged ? null : []
  );
  // The two-step lock: confirming reveals the consequence and the final confirm.
  const [confirming, setConfirming] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState(null);
  // The freshly written baseline row, set only on a successful lock, which flips
  // the flow to the confirmation.
  const [justLocked, setJustLocked] = useState(null);

  // The assembled programme, recomputed whenever the agreed resolutions change, so
  // stepping back and changing a reconcile decision re-assembles the review.
  // Null while the reconcile step is still open (no resolution set yet).
  const assembled = useMemo(() => {
    if (resolutions == null) return null;
    return assembleProgramme(
      projectStart,
      PROGRAMME_TEMPLATE,
      choices,
      resolutions,
      objectives
    );
  }, [projectStart, choices, resolutions, objectives]);

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
    setPhase(REVIEW_PHASES.REVIEW);
  };

  const handleLock = async () => {
    if (!eligibility.lockable || !assembled || locking) return;
    setLocking(true);
    setLockError(null);
    const result = await writeProgrammeBaseline(
      supabase,
      buildBaselineLockArgs({ assembled, projectId, sourceBriefId, lockedBy: userId })
    );
    // Show the confirmation only when the write succeeds. On a failed write,
    // surface the failure and leave the programme unlocked on the review.
    if (!lockSucceeded(result)) {
      setLocking(false);
      setConfirming(false);
      setLockError(LOCK_ERROR);
      return;
    }
    setLocking(false);
    setJustLocked(result.baseline);
    setPhase(REVIEW_PHASES.CONFIRMED);
  };

  const onReconcile = phase === REVIEW_PHASES.RECONCILE;
  const titleText = onReconcile
    ? 'Reconcile dates'
    : phase === REVIEW_PHASES.CONFIRMED
      ? 'Programme locked'
      : 'Review and lock';

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
      <h1 className={styles.title}>{titleText}</h1>
      <p className={styles.projectName}>{projectName}</p>
      {!canEdit && (
        <div className={styles.viewOnly}>
          <ViewOnlyBadge adminContact={adminContact} />
        </div>
      )}
      <div className={styles.steps} aria-hidden="true">
        <span className={onReconcile ? styles.stepOn : styles.stepDone}>
          1 Reconcile dates
        </span>
        <span className={styles.stepSep}>/</span>
        <span className={onReconcile ? styles.stepOff : styles.stepOn}>
          2 Review and lock
        </span>
      </div>
    </>
  );

  // ── Already locked: the project has a current baseline, so no fresh lock is
  //    offered. Re-entering set-up lands here rather than on a second lock. ──
  if (!eligibility.lockable) {
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}
        <LockedPanel
          version={existingBaseline?.version}
          lockedAt={existingBaseline?.lockedAt}
          lockerName={existingBaseline?.lockerName}
          justLocked={false}
          workspaceHref={workspaceHref}
        />
      </main>
    );
  }

  // ── Member, no baseline yet: set-up locks v1, which is an admin action, so a
  //    member sees a sparse read-only state rather than the reconcile and lock
  //    flow. (An already-locked programme is the read-only LockedPanel above,
  //    which a member sees too.) ──
  if (!canEdit) {
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}
        <div className={`${styles.placeholder} riseIn`}>
          <p className={styles.placeholderLead}>
            The programme has not been set up yet. Only an admin can set up the
            programme.
          </p>
          <Link href={workspaceHref} className={styles.cta}>
            Back to the workspace
          </Link>
        </div>
      </main>
    );
  }

  // ── The post-lock confirmation: v1 is frozen. Tracking is Phase 3, so there
  //    is no tracking surface to land on yet. ──
  if (phase === REVIEW_PHASES.CONFIRMED) {
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}
        <LockedPanel
          version={justLocked?.version}
          lockedAt={justLocked?.locked_at}
          lockerName={lockerName}
          justLocked
          workspaceHref={workspaceHref}
        />
      </main>
    );
  }

  // ── The review: the assembled programme, read-only, with the lock action. ──
  if (phase === REVIEW_PHASES.REVIEW) {
    const stages = reviewStages(assembled);
    const sum = reviewSummary(assembled);
    const canReturn = canReturnToReconcile(realityCheck.anyFlagged);
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}

        <p className={styles.lead}>
          <span className={styles.leadStrong}>Assembled from your locked Brief.</span>{' '}
          Review the gates and milestones you set, then lock them as your
          operational baseline, v1.
        </p>
        <p className={styles.subnote}>
          This is read-only. Your dates were checked in the previous step. The
          drill-down milestones the programme adds are included in v1 but are not
          listed here, so the review stays about the points you set.
        </p>

        <div className={styles.key}>
          <span className={styles.kk}>
            <span className={`${styles.sw} ${styles.swGate}`} aria-hidden="true" />
            gate
          </span>
          <span className={styles.kk}>
            <span className={`${styles.sw} ${styles.swMs}`} aria-hidden="true" />
            milestone
          </span>
          <span className={styles.kk}>
            <span className={styles.badgeCrit}>Critical</span>
            serves a non-negotiable objective
          </span>
        </div>

        <div className={styles.stages}>
          {stages.map((stage) => (
            <ReviewStage key={stage.stage} stage={stage} />
          ))}
        </div>

        <div className={styles.lockBar}>
          <p className={styles.footerSummary}>
            <span className={styles.tnum}>{sum.gates}</span> gates and{' '}
            <span className={styles.tnum}>{sum.carriedMilestones}</span> milestones
            you set
            {' · '}
            <span className={styles.tnum}>{sum.addedMilestones}</span> drill-down
            milestones included in v1
          </p>

          {lockError && (
            <p className={styles.error} role="alert">
              {lockError}
            </p>
          )}

          {confirming ? (
            <div className={styles.confirm}>
              <p className={styles.confirmText}>
                Lock this as v1? It becomes the operational baseline you track
                against. Changing it later is an explicit re-baseline.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setConfirming(false)}
                  disabled={locking}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.proceedBtn}
                  onClick={handleLock}
                  disabled={locking}
                >
                  {locking ? 'Locking…' : 'Confirm and lock v1'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.footerActions}>
              {canReturn && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setLockError(null);
                    setPhase(REVIEW_PHASES.RECONCILE);
                  }}
                >
                  Back to reconcile
                </button>
              )}
              <button
                type="button"
                className={styles.proceedBtn}
                onClick={() => {
                  setLockError(null);
                  setConfirming(true);
                }}
              >
                Lock programme v1
              </button>
            </div>
          )}
        </div>

        <p className={styles.lockNote}>
          Locking sets the operational baseline your trackers read. Forecasts and
          actuals begin after the lock. A later re-baseline is an explicit,
          recorded event, never a silent drift.
        </p>
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
