import { describe, it, expect } from 'vitest';
import {
  PHASES,
  SURFACES,
  derivePhase,
  deriveLanding,
  PHASE_INTRO,
} from '../app/pulse/app/workspace/phaseModel.js';
import { programmeTileTarget } from '../app/pulse/app/programme/trackingModel.js';

/**
 * The workspace phase model (M9.4). Proves the one place the phase is derived
 * from the two locks (never current_stage, never stored), the reopened-Brief
 * case reads Define, and the landing decision that follows from it. Programme is
 * checked through its own programmeTileTarget, which encodes the same phase
 * logic.
 *
 * What each MODULE tile does is no longer the phase's (Note 13): the three
 * monitoring modules are gated by the fixed sequence and are covered in
 * sequenceModel.test.js.
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

describe('deriveLanding: the phase decides the surface, derived not stored (M9.5)', () => {
  it('lands Define and Plan on the workspace', () => {
    expect(deriveLanding({ phase: PHASES.DEFINE })).toBe(SURFACES.WORKSPACE);
    expect(deriveLanding({ phase: PHASES.PLAN })).toBe(SURFACES.WORKSPACE);
  });

  it('lands Run on the dashboard: the delivery home', () => {
    expect(deriveLanding({ phase: PHASES.RUN })).toBe(SURFACES.DASHBOARD);
  });

  it('returns the workspace on the explicit view path, even in Run: the anti-loop', () => {
    // The dashboard back-link asks for the workspace with viewWorkspace set. In
    // Run a bare open redirects to the dashboard; this explicit ask must not, or
    // the pair loops. It returns the workspace in every phase.
    expect(deriveLanding({ phase: PHASES.RUN, viewWorkspace: true })).toBe(SURFACES.WORKSPACE);
    expect(deriveLanding({ phase: PHASES.PLAN, viewWorkspace: true })).toBe(SURFACES.WORKSPACE);
    expect(deriveLanding({ phase: PHASES.DEFINE, viewWorkspace: true })).toBe(SURFACES.WORKSPACE);
  });

  it('sends a bare open to the dashboard on Run, and only on Run', () => {
    // Only Run, and only without the explicit view path, sends a bare open to
    // the dashboard. Every other phase stays on the workspace, so the redirect
    // can never fire on a project whose Brief is open (Define) or unbaselined
    // (Plan).
    for (const phase of Object.values(PHASES)) {
      const bare = deriveLanding({ phase });
      expect(bare).toBe(phase === PHASES.RUN ? SURFACES.DASHBOARD : SURFACES.WORKSPACE);
    }
  });

  it('reverses for free: reopening the Brief on a Run project lands on the workspace', () => {
    // The reversibility (Task 3), composed from the two real functions, not
    // asserted from memory. A project in Run (both locks) lands on the dashboard.
    // Reopen the Brief (briefLocked false) with the baseline still present:
    // derivePhase reads Define, and Define lands on the workspace. The landing
    // follows the live phase, so the flip reverses with nothing stored.
    const run = derivePhase({ briefLocked: true, hasBaseline: true });
    expect(run).toBe(PHASES.RUN);
    expect(deriveLanding({ phase: run })).toBe(SURFACES.DASHBOARD);

    const reopened = derivePhase({ briefLocked: false, hasBaseline: true });
    expect(reopened).toBe(PHASES.DEFINE);
    expect(deriveLanding({ phase: reopened })).toBe(SURFACES.WORKSPACE);
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

describe('the intro line follows the phase', () => {
  it('gives one non-empty line per phase', () => {
    for (const phase of Object.values(PHASES)) {
      expect(typeof PHASE_INTRO[phase]).toBe('string');
      expect(PHASE_INTRO[phase].length).toBeGreaterThan(0);
    }
  });

  it('carries no em or en dash', () => {
    // The standing Flitrr rule: never an em or en dash in copy. Guard the copy
    // so a later edit cannot slip one in unseen.
    for (const line of Object.values(PHASE_INTRO)) {
      expect(line).not.toMatch(/[–—]/);
    }
  });
});
