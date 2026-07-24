/**
 * The sequence read (Note 13). One server-side helper that answers, for a
 * project, which step of the fixed path it is on, so the workspace and every
 * module page agree without each hand-rolling the same three reads.
 *
 * The workspace shows a module locked; this is what stops a direct URL from
 * walking straight past that lock. Both read the same derivation
 * (workspace/sequenceModel.js), so a tile and the page behind it can never
 * disagree about whether a module is open.
 *
 * Reads only, and cheaply: the Brief's lock flag, whether a current programme
 * baseline exists, and the stages whose gate rows read passed. Nothing here
 * writes, and nothing re-derives a baseline.
 */

import {
  deriveGateConfirmed,
  deriveSequenceStep,
  modulesOpen,
  moduleLockedLine,
} from '../workspace/sequenceModel';

/**
 * Read a project's sequence position. Returns
 * { step, modulesOpen, lockedLine, briefLocked, baselineLocked, gateConfirmed }.
 *
 * currentStage is passed in by the caller, which has already loaded the project
 * row, so this makes no second read of it.
 */
export async function readSequence(supabase, projectId, currentStage) {
  const [{ data: brief }, { data: baselineRow }, { data: passedGates }] =
    await Promise.all([
      supabase
        .from('project_briefs')
        .select('is_locked')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('programme_baselines')
        .select('id')
        .eq('project_id', projectId)
        .is('superseded_at', null)
        .maybeSingle(),
      supabase
        .from('project_stage_gates')
        .select('stage')
        .eq('project_id', projectId)
        .eq('gate_status', 'passed'),
    ]);

  const briefLocked = brief?.is_locked === true;
  const baselineLocked = baselineRow != null;
  const gateConfirmed = deriveGateConfirmed({
    currentStage,
    passedGateStages: (passedGates ?? []).map((g) => g?.stage),
  });
  const step = deriveSequenceStep({ briefLocked, baselineLocked, gateConfirmed });

  return {
    step,
    modulesOpen: modulesOpen(step),
    lockedLine: moduleLockedLine(step),
    briefLocked,
    baselineLocked,
    gateConfirmed,
  };
}
