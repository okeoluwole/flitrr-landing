import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { deriveRealityCheck } from '../lib/engine/programmeRealityCheck.js';
import {
  RECONCILE_DECISIONS,
  buildResolutions,
} from '../app/pulse/app/programme/setup/reconcileModel.js';
import {
  assembleProgramme,
  ITEM_ORIGIN,
} from '../lib/engine/programmeAssembly.js';
import { writeProgrammeBaseline } from '../app/pulse/app/components/programmeBaselineStore.js';
import {
  REVIEW_PHASES,
  initialReviewPhase,
  canReturnToReconcile,
  reviewStages,
  reviewSummary,
  lockEligibility,
  isLockable,
  buildBaselineLockArgs,
  lockSucceeded,
  phaseAfterLock,
} from '../app/pulse/app/programme/setup/reviewLockModel.js';

/**
 * The review-and-lock helper (Programme module Phase 2.3). Proves the pure logic
 * the review-and-lock screen renders over: the visibility filter shows the gates
 * and the carried milestones and excludes the added drill-downs while the
 * assembled programme that is written still carries all of them; lock eligibility
 * tracks whether a current baseline exists; the lock call is shaped with the
 * assembled programme, the current user, the v0 provenance, and a null re-baseline
 * reason, and that reaches the store unchanged; a changed reconcile decision
 * changes the assembled programme the review shows; the flow transitions hold,
 * including the clean-skip case; and a failed write yields no confirmation.
 *
 * Fixtures are built from the real engines (deriveRealityCheck, buildResolutions,
 * assembleProgramme) so the helper is tested against genuine output, not a
 * hand-mocked shape, and the lock call is run through the real store against a
 * fake Supabase. A fixed UTC anchor keeps the dates independent of the test
 * runner's timezone.
 */

const T = PROGRAMME_TEMPLATE;
const { ACCEPTED, KEPT } = RECONCILE_DECISIONS;
const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
const iso = (date) => date.toISOString().slice(0, 10);
const weeksFromStart = (date) => (date.getTime() - START.getTime()) / MS_PER_WEEK;

// Build the developer's programme choices from a compact per-stage spec, the same
// shape loadProgrammeChoices returns.
function makeChoices(spec) {
  const stages = T.stages.map((s) => {
    const o = spec[s.stage] ?? {};
    const milestones = {};
    for (const [key, date] of Object.entries(o.milestones ?? {})) {
      milestones[key] = { target_date: iso(date) };
    }
    return {
      stage: s.stage,
      target_date: o.gate ? iso(o.gate) : '',
      target_na: o.na === true,
      milestones,
    };
  });
  return { stages };
}

const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];

// The advised, gateWeeks-derived dates, accepted in full: every gate and every
// headline milestone at its advised position. This dates all nine headline
// milestones (carried) and leaves the four template drill-downs to be added.
const ADVISED_SPEC = {
  0: { gate: w(12), milestones: { heads_of_terms: w(6) } },
  1: { gate: w(20), milestones: { finance_committed: w(18) } },
  2: { gate: w(26), milestones: { lead_consultant: w(24) } },
  3: { gate: w(56), milestones: { planning_validated: w(40) } },
  4: { gate: w(68), milestones: { tenders_returned: w(64) } },
  5: { gate: w(120), milestones: { superstructure: w(94), finishing: w(112) } },
  6: { gate: w(126), milestones: { completion_certificate: w(124) } },
  7: { gate: w(146), milestones: { first_exchange: w(134) } },
};

// The four template drill-down milestones, added by the engine, never shown on
// the review.
const ADDED_KEYS = [
  'feasibility_confirmed',
  'consultant_scope_agreed',
  'developed_design_complete',
  'substructure_complete',
];

// Run the genuine reconcile pipeline (reality check then resolution set) and
// assemble, so the review helper is tested against the real shape the flow emits.
function assembleVia(spec, decisions, options) {
  const choices = makeChoices(spec);
  const rc = deriveRealityCheck(START, T, choices, options);
  const resolutions = buildResolutions(rc, decisions ?? {});
  const prog = assembleProgramme(START, T, choices, resolutions, OBJECTIVES);
  return { prog, rc, resolutions, choices };
}

// Flatten the milestone keys the review would show, across every stage.
function visibleMilestoneKeys(prog) {
  return reviewStages(prog).flatMap((s) => s.milestones.map((m) => m.key));
}

// Flatten every milestone key in the assembled programme, carried and added.
function allMilestoneKeys(prog) {
  const keys = [];
  for (const stage of prog.stages) {
    for (const activity of stage.activities) {
      for (const m of activity.milestones) keys.push(m.key);
    }
  }
  return keys;
}

describe('the visibility filter shows gates and carried milestones, excludes added', () => {
  const prog = assembleProgramme(START, T, makeChoices(ADVISED_SPEC), [], OBJECTIVES);
  const stages = reviewStages(prog);

  it('shows every carried (developer-dated) headline milestone', () => {
    const visible = visibleMilestoneKeys(prog);
    expect(visible).toContain('heads_of_terms');
    expect(visible).toContain('planning_validated');
    expect(visible).toContain('first_exchange');
    // Nine headline milestones were dated in the spec.
    expect(visible).toHaveLength(9);
  });

  it('excludes every added drill-down milestone from the review', () => {
    const visible = visibleMilestoneKeys(prog);
    for (const key of ADDED_KEYS) expect(visible).not.toContain(key);
    // Every shown milestone is carried, never added.
    for (const stage of stages) {
      for (const m of stage.milestones) expect(m.origin).toBe(ITEM_ORIGIN.CARRIED);
    }
  });

  it('keeps every gate, dated, in stage order', () => {
    expect(stages).toHaveLength(8);
    expect(stages.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const stage of stages) {
      expect(stage.gate.key).toBe(`gate_${stage.stage}`);
      expect(stage.gate.baselineDate).toBeInstanceOf(Date);
    }
  });

  it('leaves the assembled programme that is written carrying every point', () => {
    // The review hides the four drill-downs, but the assembled programme the
    // store freezes still contains all thirteen milestones.
    const all = allMilestoneKeys(prog);
    expect(all).toHaveLength(13);
    for (const key of ADDED_KEYS) expect(all).toContain(key);
  });

  it('reads each stage milestone in chronological order', () => {
    const s5 = stages.find((s) => s.stage === 5);
    // Stage 5 dated two headline milestones, superstructure (94) before finishing (112).
    expect(s5.milestones.map((m) => m.key)).toEqual(['superstructure', 'finishing']);
  });

  it('bakes the criticality on shown milestones, never inventing it', () => {
    const visible = reviewStages(prog).flatMap((s) => s.milestones);
    const hot = visible.find((m) => m.key === 'heads_of_terms'); // serves cost (non-negotiable)
    const lead = visible.find((m) => m.key === 'lead_consultant'); // serves quality (flexible)
    expect(hot.criticality).toBe('critical');
    expect(lead.criticality).toBe('standard');
  });
});

describe('the review summary counts what shows and what locks silently', () => {
  it('counts the dated gates, the carried milestones, and the hidden drill-downs', () => {
    const prog = assembleProgramme(START, T, makeChoices(ADVISED_SPEC), [], OBJECTIVES);
    const summary = reviewSummary(prog);
    expect(summary.gates).toBe(8);
    expect(summary.carriedMilestones).toBe(9);
    expect(summary.addedMilestones).toBe(4);
  });
});

describe('lock eligibility tracks whether a current baseline exists', () => {
  it('is lockable when there is no current baseline', () => {
    expect(lockEligibility(null).lockable).toBe(true);
    expect(lockEligibility(null).reason).toBeNull();
    expect(lockEligibility(undefined).lockable).toBe(true);
    expect(isLockable(null)).toBe(true);
  });

  it('is not lockable when a current baseline already exists', () => {
    const current = { version: 1, locked_at: '2026-06-29T00:00:00.000Z' };
    expect(lockEligibility(current).lockable).toBe(false);
    expect(lockEligibility(current).reason).toBe('already_locked');
    expect(isLockable(current)).toBe(false);
  });
});

describe('the lock call is shaped for v1', () => {
  const assembled = assembleProgramme(START, T, makeChoices(ADVISED_SPEC), [], OBJECTIVES);

  it('carries the assembled programme, the current user, the v0 provenance, and a null reason', () => {
    const args = buildBaselineLockArgs({
      assembled,
      projectId: 'project-1',
      sourceBriefId: 'brief-v0',
      lockedBy: 'user-1',
    });
    expect(args.programme).toBe(assembled);
    expect(args.projectId).toBe('project-1');
    expect(args.sourceBriefId).toBe('brief-v0');
    expect(args.lockedBy).toBe('user-1');
    expect(args.rebaselineReason).toBeNull();
  });

  it('reaches the store unchanged: the RPC gets the assembled programme, user, brief, and null reason', async () => {
    const captured = {};
    const fakeSupabase = {
      from() {
        return {
          select() {
            return { eq: () => Promise.resolve({ data: [], error: null }) };
          },
        };
      },
      rpc(fn, args) {
        captured.fn = fn;
        captured.args = args;
        return Promise.resolve({ data: { id: 'baseline-1', version: 1 }, error: null });
      },
    };

    const result = await writeProgrammeBaseline(
      fakeSupabase,
      buildBaselineLockArgs({
        assembled,
        projectId: 'project-1',
        sourceBriefId: 'brief-v0',
        lockedBy: 'user-1',
      })
    );

    expect(captured.fn).toBe('lock_programme_baseline');
    expect(captured.args.p_programme).toBe(assembled);
    expect(captured.args.p_locked_by).toBe('user-1');
    expect(captured.args.p_source_brief_id).toBe('brief-v0');
    expect(captured.args.p_rebaseline_reason).toBeNull();
    expect(captured.args.p_version).toBe(1);
    expect(lockSucceeded(result)).toBe(true);
  });
});

describe('a changed reconcile decision changes the assembled programme the review shows', () => {
  // Stage 0 gate at 31 weeks is flagged propose, recommended back to 20 weeks.
  const spec = { 0: { gate: w(31) } };

  it('accepting the recommendation shows a different gate date than keeping the developer date', () => {
    const accepted = assembleVia(spec, { gate_0: { decision: ACCEPTED, note: '' } });
    const kept = assembleVia(spec, {
      gate_0: { decision: KEPT, note: 'Holding to the agent timeline.' },
    });

    const gateOf = (prog, n) =>
      reviewStages(prog).find((s) => s.stage === n).gate.baselineDate;

    // Accepting moves gate 0 to the recommended 20 weeks; keeping holds 31.
    expect(weeksFromStart(gateOf(accepted.prog, 0))).toBe(20);
    expect(weeksFromStart(gateOf(kept.prog, 0))).toBe(31);

    // The downstream stage start moves with the agreed gate, so the review of a
    // changed decision is a genuinely different programme, not a cosmetic edit.
    const startOf = (prog, n) =>
      reviewStages(prog).find((s) => s.stage === n).stageStart;
    expect(weeksFromStart(startOf(accepted.prog, 1))).toBe(20);
    expect(weeksFromStart(startOf(kept.prog, 1))).toBe(31);
  });
});

describe('the flow transitions', () => {
  it('opens on reconcile when a date was flagged, and steps back to it from the review', () => {
    expect(initialReviewPhase(true)).toBe(REVIEW_PHASES.RECONCILE);
    expect(canReturnToReconcile(true)).toBe(true);
  });

  it('opens straight on the review in the clean-skip case, with no reconcile to return to', () => {
    expect(initialReviewPhase(false)).toBe(REVIEW_PHASES.REVIEW);
    expect(canReturnToReconcile(false)).toBe(false);
  });

  it('moves from review through a successful lock to the confirmation', () => {
    const result = { baseline: { id: 'baseline-1', version: 1 }, error: null };
    expect(phaseAfterLock(result)).toBe(REVIEW_PHASES.CONFIRMED);
  });
});

describe('a failed write yields no confirmation', () => {
  it('does not count a write with an error as a success', () => {
    expect(lockSucceeded({ baseline: null, error: new Error('write failed') })).toBe(false);
    expect(lockSucceeded({ baseline: null, error: null })).toBe(false);
    expect(lockSucceeded(null)).toBe(false);
  });

  it('keeps the developer on the review after a failed write', () => {
    const failed = { baseline: null, error: new Error('write failed') };
    expect(phaseAfterLock(failed)).toBe(REVIEW_PHASES.REVIEW);
  });

  it('a store write that errors returns no baseline and does not read as locked', async () => {
    const assembled = assembleProgramme(START, T, makeChoices(ADVISED_SPEC), [], OBJECTIVES);
    const fakeSupabase = {
      from() {
        return {
          select() {
            return { eq: () => Promise.resolve({ data: [], error: null }) };
          },
        };
      },
      rpc() {
        return Promise.resolve({ data: null, error: { message: 'rpc failed' } });
      },
    };
    const result = await writeProgrammeBaseline(
      fakeSupabase,
      buildBaselineLockArgs({ assembled, projectId: 'p', sourceBriefId: 'b', lockedBy: 'u' })
    );
    expect(result.baseline).toBeNull();
    expect(lockSucceeded(result)).toBe(false);
    expect(phaseAfterLock(result)).toBe(REVIEW_PHASES.REVIEW);
  });
});
