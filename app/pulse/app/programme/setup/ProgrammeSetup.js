'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../../lib/supabase/client';
import { PROGRAMME_TEMPLATE } from '../../../../../lib/engine/programmeTemplate.js';
import { deriveRealityCheck } from '../../../../../lib/engine/programmeRealityCheck.js';
import { assembleProgramme } from '../../../../../lib/engine/programmeAssembly.js';
import { buildObjectiveIndex } from '../../../../../lib/engine/criticality.js';
import { OBJECTIVE_META } from '../../components/objectiveMeta';
import { writeProgrammeBaseline } from '../../components/programmeBaselineStore';
import {
  RECONCILE_DECISIONS,
  flaggedItems,
  canProceed,
  checkAmendedDate,
  initialDecisions,
  reconcileSummary,
  buildResolutions,
  proceedBlockers,
  blockerLine,
  firstBlockingKey,
  toDateInputValue,
} from './reconcileModel';
import {
  recordReconcileDecisions,
  describeDecision,
} from './reconcileDecisionStore';
import {
  REVIEW_PHASES,
  initialReviewPhase,
  canReturnToReconcile,
  reviewStages,
  reviewSummary,
  lockEligibility,
  lockGuard,
  finaliseProgrammeForLock,
  buildBaselineLockArgs,
  lockSucceeded,
} from './reviewLockModel';
import {
  reconcileBaseline,
  referenceFromBriefProgramme,
  referenceFromChoices,
  describeDifference,
  formatReconciliationDate,
  RECONCILIATION_SOURCES,
} from '../../../../../lib/engine/programmeReconciliation.js';
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
 * here. It discloses everything v1 will hold (reviewLockModel.reviewStages):
 * the gates, the carried milestones the developer set (dated or honestly
 * undated, so an undated Critical milestone is named before the lock), and the
 * added drill-down milestones with the basis each was placed on. Nothing locks
 * silently.
 *
 * The lock is guarded by the reconciliation engine
 * (lib/engine/programmeReconciliation.js): v1 must match the locked Brief's
 * record set exactly, or differ only by recorded variances and disclosed
 * derivations; any named difference blocks the lock. v1's completion is also
 * compared against the Step 1 target completion, and a breach blocks the lock
 * until the developer expressly accepts it as a recorded decision, which is
 * then frozen into v1 itself. The lock is deliberate and confirmed, states
 * what it means, and writes through
 * programmeBaselineStore.writeProgrammeBaseline. This screen locks v1 only:
 * when a current baseline already exists it shows the already-locked state
 * rather than offering a second lock. A failed write surfaces the failure and
 * never claims the programme is locked.
 */

const { ACCEPTED, KEPT, AMENDED, VERIFIED, DEFERRED } = RECONCILE_DECISIONS;

const LOCK_ERROR =
  'We could not lock the programme. Please check your connection and try again, or email hello@flitrr.com.';

// A decision that cannot be recorded must not pass silently: that is the whole
// point of the grammar. The proceed is held and the developer can try again.
const DECISION_ERROR =
  'We could not record your decisions, so set-up did not continue. Please check your connection and try again, or email hello@flitrr.com.';

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

// The engine dates are UTC-midnight instants, so format in UTC to keep the
// displayed day stable regardless of the viewer's timezone and identical to
// the tracking surface, which renders the same assembled dates.
function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
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

// The DOM id a flagged card carries, so the footer's named blocker can scroll to
// the first gap. Point keys are already unique across a reality check.
function cardDomId(key) {
  return `reconcile-${key}`;
}

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

// One decision option. Even-handed with its siblings: no default selection, no
// visual nudge toward one answer, the chosen one taking the bright fill.
function Choice({ selected, lead, sub, onClick, wide = false }) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${wide ? styles.choiceForce : ''} ${
        selected ? styles.choiceSelected : ''
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className={styles.choiceLead}>{lead}</span>
      {sub && <span className={styles.choiceSub}>{sub}</span>}
    </button>
  );
}

// The amend field (Note 14), shown once amend is chosen: the operational date
// the developer sets, and an optional line on why. It never touches the locked
// Brief; the gap between this date and the Brief's is recorded as a variance.
function AmendField({ item, state, onAmendDate, onNote }) {
  const check = checkAmendedDate(item, state);
  return (
    <>
      <label className={styles.amendField}>
        <span className={styles.reasonLabel}>
          The date to work to
          <span className={styles.reasonRequired}> Required</span>
        </span>
        <input
          type="date"
          className={styles.dateInput}
          value={state.amendedDate ?? ''}
          onChange={(e) => onAmendDate(e.target.value)}
        />
        {check.reason === 'below_floor' && (
          <span className={styles.amendWarn} role="alert">
            This is still below the confirmed requirement of{' '}
            {formatDate(item.recommendedDate)}. Set a date on or after it.
          </span>
        )}
      </label>
      <label className={styles.reasonField}>
        <span className={styles.reasonLabel}>
          Why this date?
          <span className={styles.reasonOptional}> Optional</span>
        </span>
        <textarea
          className={styles.reasonInput}
          rows={2}
          value={state.note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Recorded with the decision, as a variance from your Brief."
        />
      </label>
    </>
  );
}

// The propose controls: accept, keep, or amend, presented evenly with no
// default. Keep reveals a required reason, because a kept divergence is recorded
// as a risk. Amend is the third answer, for when neither offered date is right.
function ProposeControls({ item, state, onDecide, onNote, onAmendDate }) {
  return (
    <div className={styles.controls}>
      <div className={styles.choices} role="group" aria-label="Choose a date">
        <Choice
          selected={state.decision === ACCEPTED}
          lead="Accept the recommendation"
          sub={formatDate(item.recommendedDate)}
          onClick={() => onDecide(ACCEPTED)}
        />
        <Choice
          selected={state.decision === KEPT}
          lead="Keep your date"
          sub={formatDate(item.developerDate)}
          onClick={() => onDecide(KEPT)}
        />
        <Choice
          selected={state.decision === AMENDED}
          lead="Amend the date"
          sub="Neither of these is right"
          onClick={() => onDecide(AMENDED)}
        />
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
      {state.decision === AMENDED && (
        <AmendField
          item={item}
          state={state}
          onAmendDate={onAmendDate}
          onNote={onNote}
        />
      )}
    </div>
  );
}

// The force controls: accept the compliant date, or amend to another date that
// still clears the floor. A breached hard floor can never be KEPT, and an amend
// below the floor is refused, so the mechanic is untouched by the widening.
function ForceControls({ item, state, onDecide, onNote, onAmendDate }) {
  return (
    <div className={styles.controls}>
      <p className={styles.forceNote}>
        This date falls below a confirmed requirement, so it cannot be kept. Move
        it to the compliant date, or set your own date on or after it.
      </p>
      <div className={styles.choices} role="group" aria-label="Choose a date">
        <Choice
          selected={state.decision === ACCEPTED}
          lead="Move to the compliant date"
          sub={formatDate(item.recommendedDate)}
          onClick={() => onDecide(ACCEPTED)}
          wide
        />
        <Choice
          selected={state.decision === AMENDED}
          lead="Amend the date"
          sub="A later date of your own"
          onClick={() => onDecide(AMENDED)}
          wide
        />
      </div>
      {state.decision === AMENDED && (
        <AmendField
          item={item}
          state={state}
          onAmendDate={onAmendDate}
          onNote={onNote}
        />
      )}
    </div>
  );
}

// The flag_verify controls (Note 14). PULSE refuses to invent a jurisdictional
// number here, so there is no recommendation to accept, but the card still ends
// in a recorded decision, one of three:
//   Confirm      the attestation, with who and when on the record
//   Amend        the check found a different date, so set it
//   Verify later the flow proceeds on your date and an open verification action
//                is raised on the Action Log, so nothing is waved through
function VerifyControls({ item, state, onDecide, onNote, onAmendDate }) {
  return (
    <div className={styles.controls}>
      <div
        className={styles.choices}
        role="group"
        aria-label="Record your decision"
      >
        <Choice
          selected={state.decision === VERIFIED}
          lead="Confirm, verified locally"
          sub={formatDate(item.developerDate)}
          onClick={() => onDecide(VERIFIED)}
        />
        <Choice
          selected={state.decision === AMENDED}
          lead="Amend the date"
          sub="The check found a different date"
          onClick={() => onDecide(AMENDED)}
        />
        <Choice
          selected={state.decision === DEFERRED}
          lead="Verify later"
          sub="Proceed and check this after"
          onClick={() => onDecide(DEFERRED)}
        />
      </div>
      {state.decision === VERIFIED && (
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
      {state.decision === AMENDED && (
        <AmendField
          item={item}
          state={state}
          onAmendDate={onAmendDate}
          onNote={onNote}
        />
      )}
      {state.decision === DEFERRED && (
        <p className={styles.deferNote}>
          Set-up continues on your own date. An open action to verify it is added
          to your Action Log, so the check is tracked, not lost.
        </p>
      )}
    </div>
  );
}

// One flagged item as a card: its identity, its dates, the reason, and the
// tier's decision controls. The card carries the item's key as its DOM id so the
// footer's named blocker can jump straight to the first undecided one.
function ReconcileCard({ item, state, onDecide, onNote, onAmendDate }) {
  const isForce = item.tier === 'force';
  const kindLabel = KIND_LABEL[item.kind] ?? item.kind;
  const servesType = item.kind === 'milestone' ? SERVES_BY_KEY[item.key] : null;
  const servesName = servesType ? OBJECTIVE_NAME[servesType] : null;

  return (
    <article
      id={cardDomId(item.key)}
      className={`${styles.card} ${isForce ? styles.cardCritical : ''}`}
    >
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
          onAmendDate={onAmendDate}
        />
      )}
      {item.tier === 'force' && (
        <ForceControls
          item={item}
          state={state}
          onDecide={onDecide}
          onNote={onNote}
          onAmendDate={onAmendDate}
        />
      )}
      {item.tier === 'flag_verify' && (
        <VerifyControls
          item={item}
          state={state}
          onDecide={onDecide}
          onNote={onNote}
          onAmendDate={onAmendDate}
        />
      )}
    </article>
  );
}

/**
 * The named blocker beside a disabled action (Note 14). In test, a selected
 * "Keep your date" with an empty reason rendered the proceed button dead with no
 * indication of what was missing, which read as "keeping your date is not
 * allowed". The fix is the affordance, not the mechanic: the gap is named, and
 * where the caller supplies a target the developer can jump straight to it.
 * Renders nothing when nothing is blocking.
 */
function BlockerHint({ line, onJump }) {
  if (!line) return null;
  return (
    <span className={styles.blockerLine} role="status">
      <span>{line}</span>
      {onJump && (
        <button type="button" className={styles.blockerJump} onClick={onJump}>
          Go to the first one
        </button>
      )}
    </span>
  );
}

// A longer date stamp for the locked record (a DB timestamp, an ISO string or a
// Date). Distinct from formatDate, which reads the assembled Date baseline dates.
// Pinned to UTC so the recorded day reads the same for every viewer and matches
// the tracking surface's stamp of the same lock.
function formatStamp(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// A compact date for a stage span, two-digit year to read at a glance. UTC for
// the same reason as formatDate.
function formatShort(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
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
// never derived here. An undated point reads "Not dated" plainly: it stays
// undated in v1 and is named here rather than locking out of sight.
function MilestoneRow({ milestone }) {
  const servesName = OBJECTIVE_NAME[milestone.serves] ?? null;
  const critical = milestone.criticality === 'critical';
  const dateLabel = formatDate(milestone.baselineDate);
  return (
    <div className={styles.item}>
      <span className={`${styles.mk} ${styles.mkMs}`} aria-hidden="true" />
      <span className={styles.iname}>{milestone.name}</span>
      <span className={styles.imeta}>
        {servesName ? `serves ${servesName}` : 'milestone'}
      </span>
      <span
        className={`${styles.idate} tnum ${dateLabel ? '' : styles.idateTbc}`}
      >
        {dateLabel ?? 'Not dated'}
      </span>
      <span className={critical ? styles.badgeCrit : styles.badgeStd}>
        {critical ? 'Critical' : 'Standard'}
      </span>
    </div>
  );
}

// One added drill-down milestone row: a point PULSE placed, listed with the
// basis it was placed on so no derivation locks undisclosed. A protected point
// carries no derived date and says so.
function AddedMilestoneRow({ milestone }) {
  const critical = milestone.criticality === 'critical';
  const dateLabel = formatDate(milestone.baselineDate);
  const basis = dateLabel
    ? `added by PULSE, stage start plus ${milestone.offsetWeeks} wk`
    : 'added by PULSE, no date derived (protected)';
  return (
    <div className={`${styles.item} ${styles.itemAdded}`}>
      <span className={`${styles.mk} ${styles.mkMs}`} aria-hidden="true" />
      <span className={styles.iname}>{milestone.name}</span>
      <span className={styles.imeta}>{basis}</span>
      <span
        className={`${styles.idate} tnum ${dateLabel ? '' : styles.idateTbc}`}
      >
        {dateLabel ?? 'Not dated'}
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
        {(stage.addedMilestones ?? []).map((m) => (
          <AddedMilestoneRow key={m.key} milestone={m} />
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
  stageStates = null,
  choices,
  projectId,
  objectives,
  sourceBriefId,
  briefProgramme = null,
  targetCompletionDate = null,
  userId,
  lockerName,
  existingBaseline,
  canEdit = true,
  adminContact = null,
}) {
  // The reality check, run once over the loaded inputs. Pure and deterministic.
  // The stage states come from the server, derived off the baseline, so a stage
  // that runs concurrent is measured from its window start here exactly as the
  // Brief's Step 7 measured it.
  const realityCheck = useMemo(
    () =>
      deriveRealityCheck(projectStart, PROGRAMME_TEMPLATE, choices, {
        stageStates,
      }),
    [projectStart, choices, stageStates]
  );
  const flagged = useMemo(() => flaggedItems(realityCheck), [realityCheck]);
  const summary = useMemo(() => reconcileSummary(realityCheck), [realityCheck]);

  // The objective index the decision records read: the id per objective type,
  // for linking a verification action to the objective its point serves, and the
  // kernel's by-id index, so the action's stamped criticality is the cascade
  // value rather than an invented one.
  const objectiveIdByType = useMemo(
    () =>
      Object.fromEntries(
        (objectives ?? [])
          .filter((o) => o?.id != null && o?.objective_type != null)
          .map((o) => [o.objective_type, o.id])
      ),
    [objectives]
  );
  const objectivesById = useMemo(
    () => buildObjectiveIndex(objectives ?? []).byId,
    [objectives]
  );

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
  // The decision write (Note 14): in flight, and its failure. Held here rather
  // than inside the proceed so the footer can disable and explain together.
  const [recording, setRecording] = useState(false);
  const [decisionError, setDecisionError] = useState(null);
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
      objectives,
      { stageStates }
    );
  }, [projectStart, choices, resolutions, objectives, stageStates]);

  // The lock-time reconciliation: v1 against the locked Brief's record set
  // (falling back to the live choices for a Brief locked before the record set
  // existed), plus the completion comparison against the Step 1 target. Pure
  // and recomputed with the assembly, so a changed reconcile decision re-runs
  // the check too.
  const reconciliation = useMemo(() => {
    if (assembled == null) return null;
    const reference =
      referenceFromBriefProgramme(briefProgramme) ?? referenceFromChoices(choices);
    return reconcileBaseline({
      assembled,
      reference,
      resolutions: resolutions ?? [],
      targetCompletionDate,
    });
  }, [assembled, briefProgramme, choices, resolutions, targetCompletionDate]);

  // The express acceptance of a completion breach: a deliberate tick, never a
  // default, recorded into v1 at lock.
  const [breachAccepted, setBreachAccepted] = useState(false);

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
  const setAmendedDate = (key, amendedDate) =>
    setDecisions((prev) => ({
      ...prev,
      [key]: { ...prev[key], amendedDate },
    }));

  const ready = canProceed(realityCheck, decisions);
  const blockers = proceedBlockers(realityCheck, decisions);
  const blockerText = blockerLine(blockers);

  // Move the developer to the first gap rather than leaving them to hunt for it.
  const jumpToFirstGap = () => {
    const key = firstBlockingKey(realityCheck, decisions);
    if (key == null || typeof document === 'undefined') return;
    document
      .getElementById(cardDomId(key))
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // The proceed. The decisions are RECORDED before the flow moves on: a
  // baseline-setting decision that leaves no trace is the silent omission Note
  // 14 exists to close, so a failed write holds the proceed rather than passing
  // through. A deferral raises its open verification action in the same call.
  const handleProceed = async () => {
    if (!ready || recording) return;
    const resolved = buildResolutions(realityCheck, decisions);
    setRecording(true);
    setDecisionError(null);
    const { error } = await recordReconcileDecisions(supabase, {
      projectId,
      sourceBriefId,
      decidedBy: userId,
      resolutions: resolved,
      objectiveIdFor: (resolution) =>
        objectiveIdByType[SERVES_BY_KEY[resolution.key]] ?? null,
      objectivesById,
    });
    setRecording(false);
    if (error) {
      setDecisionError(DECISION_ERROR);
      return;
    }
    setResolutions(resolved);
    setPhase(REVIEW_PHASES.REVIEW);
  };

  // The lock guard: no lock while a named difference stands, and none while a
  // completion breach sits unaccepted.
  const guard = lockGuard(reconciliation, breachAccepted);

  const handleLock = async () => {
    if (!eligibility.lockable || !assembled || locking) return;
    if (!guard.allowed) return;
    setLocking(true);
    setLockError(null);
    // The frozen v1 carries its own proof: the reconciliation result, the
    // disclosed derivations, and any accepted completion breach as the
    // recorded decision.
    const finalised = finaliseProgrammeForLock(
      assembled,
      reconciliation,
      breachAccepted,
      resolutions ?? []
    );
    const result = await writeProgrammeBaseline(
      supabase,
      buildBaselineLockArgs({ assembled: finalised, projectId, sourceBriefId, lockedBy: userId })
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
          This is read-only. Your dates were checked in the previous step. Every
          point v1 will hold is listed here: the points you set, and any
          drill-down point PULSE adds, each with the basis it was placed on. A
          point you left undated stays undated; PULSE never dates your points
          for you.
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

        {/* The recorded decisions (Note 14). Every answer given at Reconcile
            dates, named before the lock, so the developer locks knowing exactly
            what was decided and on what basis. The same set is frozen into v1,
            so the baseline carries its own approvals trail. */}
        {resolutions && resolutions.length > 0 && (
          <div className={styles.recon}>
            <p className={styles.reconLead}>
              <CheckIcon />
              {resolutions.length === 1
                ? '1 decision recorded against your Brief, with who decided and when.'
                : `${resolutions.length} decisions recorded against your Brief, with who decided and when.`}
            </p>
            <ul className={styles.reconList}>
              {resolutions.map((res) => (
                <li key={`decision:${res.key}`} className={styles.reconItem}>
                  {describeDecision(res)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {reconciliation && (
          <div
            className={`${styles.recon} ${
              reconciliation.ok ? '' : styles.reconBad
            }`}
          >
            {reconciliation.ok ? (
              <p className={styles.reconLead}>
                <CheckIcon />
                v1 matches your locked{' '}
                {reconciliation.source === RECONCILIATION_SOURCES.BRIEF
                  ? 'Brief'
                  : 'programme record'}{' '}
                point for point
                {resolutions && resolutions.length > 0
                  ? `, with ${resolutions.length} recorded ${
                      resolutions.length === 1 ? 'variance' : 'variances'
                    } from the reconcile step`
                  : ''}
                {reconciliation.derivations.length > 0
                  ? ` and ${reconciliation.derivations.length} disclosed ${
                      reconciliation.derivations.length === 1
                        ? 'derivation'
                        : 'derivations'
                    } listed above`
                  : ''}
                .
              </p>
            ) : (
              <>
                <p className={styles.reconLeadBad}>
                  v1 does not match your locked record. The lock is blocked until
                  every difference below is resolved.
                </p>
                <ul className={styles.reconList}>
                  {reconciliation.differences.map((diff) => (
                    <li key={`${diff.kind}:${diff.key}`} className={styles.reconItem}>
                      {describeDifference(diff)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {reconciliation.completion.breached ? (
              <div className={styles.breach}>
                <p className={styles.breachText}>
                  v1 completes on{' '}
                  {formatReconciliationDate(
                    reconciliation.completion.baselineCompletionDate
                  )}
                  , {Math.round(reconciliation.completion.weeksLate)}{' '}
                  {Math.round(reconciliation.completion.weeksLate) === 1
                    ? 'week'
                    : 'weeks'}{' '}
                  after your target completion of{' '}
                  {formatReconciliationDate(
                    reconciliation.completion.targetCompletionDate
                  )}
                  . Locking this is a decision, not a default.
                </p>
                <label className={styles.verifyCheck}>
                  <input
                    type="checkbox"
                    className={styles.verifyBox}
                    checked={breachAccepted}
                    onChange={(e) => setBreachAccepted(e.target.checked)}
                  />
                  <span className={styles.verifyLabel}>
                    I accept that v1 completes after the target completion. Record
                    this decision on v1.
                  </span>
                </label>
              </div>
            ) : reconciliation.completion.targetCompletionDate &&
              reconciliation.completion.baselineCompletionDate ? (
              <p className={styles.reconMeta}>
                v1 completes on{' '}
                {formatReconciliationDate(
                  reconciliation.completion.baselineCompletionDate
                )}
                , within your target completion of{' '}
                {formatReconciliationDate(
                  reconciliation.completion.targetCompletionDate
                )}
                .
              </p>
            ) : null}
          </div>
        )}

        <div className={styles.lockBar}>
          <p className={styles.footerSummary}>
            <span className={styles.tnum}>{sum.gates}</span> gates and{' '}
            <span className={styles.tnum}>{sum.carriedMilestones}</span> milestones
            you set
            {sum.undatedCarried > 0 ? (
              <>
                {' '}
                (<span className={styles.tnum}>{sum.undatedCarried}</span> not
                dated)
              </>
            ) : null}
            {' · '}
            <span className={styles.tnum}>{sum.addedMilestones}</span> drill-down
            milestones listed and included in v1
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
                  disabled={locking || !guard.allowed}
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
              {/* The same named-blocker affordance the reconcile footer uses:
                  a disabled action always says what is missing. */}
              <BlockerHint
                line={
                  guard.allowed
                    ? null
                    : guard.reason === 'differences'
                      ? 'Resolve the named differences above to lock.'
                      : guard.reason === 'breach_not_accepted'
                        ? 'Accept the completion breach above, or revisit your dates, to lock.'
                        : 'The reconciliation check has not run.'
                }
              />
              <button
                type="button"
                className={styles.proceedBtn}
                onClick={() => {
                  setLockError(null);
                  setConfirming(true);
                }}
                disabled={!guard.allowed}
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
        Every answer is recorded against your Brief, with who decided and when.
        Keeping your own date is fine: it records a risk on the log, so the
        optimism is tracked, not hidden. Amending sets the date you will work to
        and records the variance; your locked Brief is never rewritten. The rest
        of your dates sit within normal ranges and are not shown here.
      </p>

      <div className={styles.cards}>
        {flagged.map((item) => (
          <ReconcileCard
            key={item.key}
            item={item}
            state={decisions[item.key]}
            onDecide={(decision) => setDecision(item.key, decision)}
            onNote={(note) => setNote(item.key, note)}
            onAmendDate={(date) => setAmendedDate(item.key, date)}
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

        {decisionError && (
          <p className={styles.error} role="alert">
            {decisionError}
          </p>
        )}

        <div className={styles.footerActions}>
          <BlockerHint line={blockerText} onJump={jumpToFirstGap} />
          <button
            type="button"
            className={styles.proceedBtn}
            onClick={handleProceed}
            disabled={!ready || recording}
          >
            {recording ? 'Recording…' : 'Assemble programme'}
          </button>
        </div>
      </div>
    </main>
  );
}
