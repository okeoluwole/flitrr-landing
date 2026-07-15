import { describe, it, expect } from 'vitest';
import {
  PHASES,
  derivePhase,
  deriveTileStates,
  PHASE_INTRO,
} from '../app/pulse/app/workspace/phaseModel.js';
import { programmeTileTarget } from '../app/pulse/app/programme/trackingModel.js';
import { actionLogLockedFooter } from '../app/pulse/app/actions/actionModel.js';
import { RISK_LOCKED_COPY } from '../app/pulse/app/risk/riskModel.js';

/**
 * The workspace phase model (M9.4). Proves the one place the phase is derived
 * from the two locks (never current_stage, never stored), the reopened-Brief
 * case reads Define, and every tile reads its state through that phase, with
 * the Action Log the one exception: it keys on the gate, independent of the
 * phase, so run-before-gate comes out locked while plan-after-gate comes out
 * open. Programme is checked through its own programmeTileTarget, which encodes
 * the same phase logic. The two shared locked strings are checked so the tile
 * and page copy can be trusted to match their guards.
 */

// The six reachable (phase, gatePassed) states, each a real workspace state the
// reconnaissance confirmed, so nothing below tests an impossible combination.
const STATES = [
  { name: 'Define, gate not passed (fresh)', phase: PHASES.DEFINE, gatePassed: false },
  { name: 'Define, gate passed (reopened Brief after the gate)', phase: PHASES.DEFINE, gatePassed: true },
  { name: 'Plan, gate not passed (typical Plan)', phase: PHASES.PLAN, gatePassed: false },
  { name: 'Plan, gate passed (gate passed, no baseline yet)', phase: PHASES.PLAN, gatePassed: true },
  { name: 'Run, gate not passed (Programme locked at Stage 1)', phase: PHASES.RUN, gatePassed: false },
  { name: 'Run, gate passed (full delivery)', phase: PHASES.RUN, gatePassed: true },
];

describe('derivePhase: the two locks in, one phase out', () => {
  it('reads Define whenever the Brief is not locked, whatever the baseline', () => {
    // The fresh case, and the reopened-Brief case (baseline exists, Brief open),
    // both read Define: the Brief is the spine, so an open Brief means the
    // project is being redefined whatever else exists.
    expect(derivePhase({ briefLocked: false, hasBaseline: false })).toBe(PHASES.DEFINE);
    expect(derivePhase({ briefLocked: false, hasBaseline: true })).toBe(PHASES.DEFINE);
  });

  it('reads Plan when the Brief is locked and no baseline is locked', () => {
    expect(derivePhase({ briefLocked: true, hasBaseline: false })).toBe(PHASES.PLAN);
  });

  it('reads Run when the Brief is locked and a baseline is locked', () => {
    expect(derivePhase({ briefLocked: true, hasBaseline: true })).toBe(PHASES.RUN);
  });

  it('takes no current_stage input at all: the phase cannot depend on the gate', () => {
    // The derivation reads only the two locks. Passing a stage-shaped field
    // must not change the result; the phase is a pure function of the locks.
    const withStage = { briefLocked: true, hasBaseline: false, current_stage: 5 };
    expect(derivePhase(withStage)).toBe(PHASES.PLAN);
  });
});

describe('deriveTileStates: Risk and the Dashboard open at the Brief lock', () => {
  it('locks Risk in Define and opens it from Plan on', () => {
    expect(deriveTileStates({ phase: PHASES.DEFINE, gatePassed: false }).risk).toBe('locked');
    expect(deriveTileStates({ phase: PHASES.DEFINE, gatePassed: true }).risk).toBe('locked');
    expect(deriveTileStates({ phase: PHASES.PLAN, gatePassed: false }).risk).toBe('open');
    expect(deriveTileStates({ phase: PHASES.RUN, gatePassed: false }).risk).toBe('open');
  });

  it('locks the Dashboard in Define and opens it from Plan on', () => {
    expect(deriveTileStates({ phase: PHASES.DEFINE, gatePassed: false }).dashboard).toBe('locked');
    expect(deriveTileStates({ phase: PHASES.PLAN, gatePassed: false }).dashboard).toBe('open');
    expect(deriveTileStates({ phase: PHASES.RUN, gatePassed: true }).dashboard).toBe('open');
  });
});

describe('deriveTileStates: the Action Log keys on the gate, not the phase', () => {
  it('opens with the gate and locks without it, in every phase', () => {
    // The independence, stated as a test: for every phase, the Action Log's
    // state is exactly gatePassed. It never moves with the locks.
    for (const phase of Object.values(PHASES)) {
      expect(deriveTileStates({ phase, gatePassed: true }).actionLog).toBe('open');
      expect(deriveTileStates({ phase, gatePassed: false }).actionLog).toBe('locked');
    }
  });

  it('locks in run-before-gate and opens in plan-after-gate: the gate drives it', () => {
    // Run with both locks but the gate not passed: the Action Log is still
    // locked, because it answers to the gate alone.
    expect(deriveTileStates({ phase: PHASES.RUN, gatePassed: false }).actionLog).toBe('locked');
    // Plan with the gate passed but no baseline: the Action Log is open, again
    // because the gate, not the phase, decides.
    expect(deriveTileStates({ phase: PHASES.PLAN, gatePassed: true }).actionLog).toBe('open');
  });

  it('does not drag Risk or the Dashboard open when only the gate is passed', () => {
    // Reopened Brief after the gate: gate passed, but the Brief is open, so
    // Risk and the Dashboard are locked while the Action Log is open. The gate
    // opens the Action Log, nothing else.
    const s = deriveTileStates({ phase: PHASES.DEFINE, gatePassed: true });
    expect(s).toEqual({ risk: 'locked', dashboard: 'locked', actionLog: 'open' });
  });
});

describe('Programme tile (programmeTileTarget): open from Plan onward', () => {
  const PID = '00000000-0000-4000-8000-000000000000';

  it('is locked in Define and open in Plan and Run, in step with the phase', () => {
    // Define: Brief not locked.
    expect(programmeTileTarget(PID, { briefLocked: false, hasBaseline: false }).state).toBe('locked');
    // Plan: Brief locked, no baseline (set-up).
    expect(programmeTileTarget(PID, { briefLocked: true, hasBaseline: false }).state).toBe('open');
    // Run: Brief locked, baseline locked (tracking).
    expect(programmeTileTarget(PID, { briefLocked: true, hasBaseline: true }).state).toBe('open');
  });
});

describe('the shared locked copy: tile and page cannot disagree', () => {
  it('Risk locked copy names the Brief lock, the gate Risk now opens on', () => {
    expect(RISK_LOCKED_COPY).toBe('Risk monitoring opens once you lock your Brief.');
  });

  it('Action Log locked footer names the Brief lock in Define, the gate alone after it', () => {
    // Define (Brief not locked): both the lock and the gate are still ahead.
    expect(actionLogLockedFooter(false)).toBe(
      'Opens once you lock your Brief and pass the gate into Stage 2.'
    );
    // Plan and gate-not-passed Run (Brief locked): only the gate remains.
    expect(actionLogLockedFooter(true)).toBe(
      'Pass the gate into Stage 2 to start logging actions.'
    );
  });
});

describe('the intro line follows the phase', () => {
  it('gives one non-empty line per phase', () => {
    for (const phase of Object.values(PHASES)) {
      expect(typeof PHASE_INTRO[phase]).toBe('string');
      expect(PHASE_INTRO[phase].length).toBeGreaterThan(0);
    }
  });

  it('carries no em or en dash, in any of the M9.4 strings', () => {
    // The standing Flitrr rule: never an em or en dash in copy. Guard the copy
    // this sub-step adds so a later edit cannot slip one in unseen.
    const strings = [
      ...Object.values(PHASE_INTRO),
      RISK_LOCKED_COPY,
      actionLogLockedFooter(false),
      actionLogLockedFooter(true),
    ];
    for (const s of strings) {
      expect(s).not.toMatch(/[–—]/);
    }
  });
});
