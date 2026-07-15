/**
 * The Project Dashboard display model (Dashboard module, M9.2, extended M9.3).
 * The pure logic behind the dashboard surface: the one assembly that feeds the
 * objective health engine, the Band 1 facts, the Band 2 row order, and (M9.3)
 * the Band 3 attention list, which attentionModel.js composes over the same
 * inputs plus the health engine's output. The screen is a thin render over
 * this helper, so correctness lives here, not in the component.
 *
 * Pure and deterministic: no DB, no React, no clock. The surface reads today
 * ONCE and passes it down; the engines never read the clock. Everything else
 * arrives as loaded rows and the frozen baseline's programme.
 *
 * CALL, NEVER RECOMPUTE. The three Programme engines (deriveProgress,
 * deriveRAG, deriveForecast) are called here exactly as the tracking surface
 * calls them, and their outputs are joined, never re-derived. The baseline's
 * own completion is read off forecastCompletionTile (the tracking model
 * already computes it: the latest baseline date across trackable points), not
 * reimplemented. Gate readiness is the engine's gateReadiness, the Action
 * Log's own computation, with the dashboard as its second consumer.
 *
 * THE TOLERANCE IS THE PROGRAMME'S. The RAG derivation and the health engine
 * run at EXACTLY the Programme surface's default: toleranceWeeksFor(
 * DEFAULT_TOLERANCE_KEY) from the Programme's own model. The dashboard never
 * supplies its own number and offers no dial: it is read-only, and if the two
 * surfaces defaulted differently the same milestone would read amber on one
 * screen and red on the other.
 *
 * MILESTONES COME ONLY FROM THE BASELINE SNAPSHOT (programme_baselines,
 * superseded_at null). The project_milestones table is dead and is never
 * read, here or anywhere downstream.
 *
 * WHAT THIS MODEL DOES NOT DO. No copy string (dashboardRead.js owns every
 * sentence); no persistence; no write of any kind; no tolerance setting of
 * its own.
 */

import { deriveProgress } from '../../../../lib/engine/programmeProgress';
import { deriveRAG } from '../../../../lib/engine/programmeRAG';
import { deriveForecast } from '../../../../lib/engine/programmeForecast';
import {
  deriveObjectiveHealth,
  HEALTH_STATES,
} from '../../../../lib/engine/objectiveHealth';
import { gateReadiness } from '../../../../lib/engine/readiness';
import { buildObjectiveIndex } from '../../../../lib/engine/criticality';
import { deriveAttention } from './attentionModel';
import {
  DEFAULT_TOLERANCE_KEY,
  toleranceWeeksFor,
  forecastCompletionTile,
  completeTile,
} from '../programme/trackingModel';
import { OBJECTIVE_ORDER } from '../components/objectiveMeta';

// The Band 2 order within a block: worst state first, holding beneath the
// pressured states, Not scored rows always beneath the scored ones. The two
// ladders share ranks because a block only ever holds one ladder.
const STATE_ORDER = {
  [HEALTH_STATES.COMPROMISED]: 0,
  [HEALTH_STATES.EXHAUSTED]: 0,
  [HEALTH_STATES.UNDER_PRESSURE]: 1,
  [HEALTH_STATES.ABSORBING]: 1,
  [HEALTH_STATES.HOLDING]: 2,
  [HEALTH_STATES.NOT_SCORED]: 3,
};

/**
 * The five objective rows in the canonical framework order (Scope, Cost,
 * Time, Quality, Funding), the stable base order the health engine preserves
 * and the Band 2 sort ties break on.
 */
export function sortObjectivesCanonical(objectives) {
  const rank = new Map(OBJECTIVE_ORDER.map((type, i) => [type, i]));
  return [...(objectives ?? [])].sort(
    (a, b) =>
      (rank.get(a?.objective_type) ?? OBJECTIVE_ORDER.length) -
      (rank.get(b?.objective_type) ?? OBJECTIVE_ORDER.length)
  );
}

/**
 * The Band 2 row order over the engine's objective rows: the protected block
 * first and flexible second (proportional monitoring rendered in structure),
 * worst state first within each block, Not scored rows beneath the scored
 * ones, and the canonical objective order breaking ties. Stable: the engine
 * rows arrive in canonical order and equal keys keep it.
 */
export function orderHealthRows(objectiveRows) {
  return [...(objectiveRows ?? [])]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (a.row.isProtected !== b.row.isProtected) {
        return a.row.isProtected ? -1 : 1;
      }
      const stateDiff =
        (STATE_ORDER[a.row.state] ?? 9) - (STATE_ORDER[b.row.state] ?? 9);
      if (stateDiff !== 0) return stateDiff;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * The next gate ahead, from the frozen baseline snapshot and the met-points
 * view: the first applicable stage, in stage order, whose gate is not met.
 * Returns { stage, name, baselineDate } (the snapshot's own baked fields), or
 * null when no gate lies ahead. Gates come only from the snapshot; the
 * project_milestones table is dead and never read.
 */
export function nextGate(programme, metPoints) {
  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const gate = stage.gate;
    if (gate?.key == null) continue;
    if (metPoints?.[gate.key]?.met === true) continue;
    return {
      stage: stage.stage ?? null,
      name: gate.name ?? null,
      baselineDate: gate.baselineDate ?? null,
    };
  }
  return null;
}

/**
 * Assemble the whole dashboard read for a project. One call, everything the
 * surface renders.
 *
 * input:
 *   objectives            project_objectives rows
 *   risks                 project_risks rows
 *   actions               project_actions rows
 *   programme             the CURRENT baseline's frozen programme
 *                         (programme_baselines.programme, superseded_at IS
 *                         NULL), or null when none is locked
 *   metPoints             the met-points view (buildMetPointsView's output)
 *   todayIso              today, read once by the surface, ISO string
 *   targetCompletionDate  projects.target_completion_date, or null
 *   currentStage          projects.current_stage
 *
 * Returns:
 *   {
 *     health,          deriveObjectiveHealth's full output
 *     rows,            health.objectives in Band 2 order
 *     attention,       deriveAttention's Band 3 read: { items, total,
 *                      overflow, overflowModule }
 *     facts: {
 *       currentStage,
 *       percentComplete,       rounded, or null with no baseline
 *       forecastCompletion,    the forecast engine's completion, or null
 *       targetCompletionDate,  passed through
 *       nextGate,              { stage, name, baselineDate } or null
 *       readiness,             { open, critical } for the current stage's gate
 *       hasBaseline,
 *     },
 *     toleranceWeeks,  the Programme default the whole read ran at
 *   }
 */
export function deriveDashboard({
  objectives,
  risks,
  actions,
  programme,
  metPoints,
  todayIso,
  targetCompletionDate,
  currentStage,
}) {
  const hasBaseline = programme != null && typeof programme === 'object';
  const toleranceWeeks = toleranceWeeksFor(DEFAULT_TOLERANCE_KEY);
  const met = metPoints ?? {};

  // The three Programme engines, exactly as the tracking surface runs them.
  const progress = hasBaseline ? deriveProgress(programme, met) : null;
  const rag = hasBaseline
    ? deriveRAG(programme, met, todayIso, toleranceWeeks)
    : null;
  const forecast = hasBaseline ? deriveForecast(programme, met, todayIso) : null;

  // The two completions, off the tracking model's existing computation: the
  // forecast completion passed through, and the baseline's own completion
  // (the latest baseline date across trackable points). Never reimplemented.
  const completion = hasBaseline
    ? forecastCompletionTile(programme, forecast)
    : null;

  const orderedObjectives = sortObjectivesCanonical(objectives);

  const health = deriveObjectiveHealth({
    objectives: orderedObjectives,
    risks: risks ?? [],
    actions: actions ?? [],
    baseline: hasBaseline ? programme : null,
    ragFlagged: rag?.flagged ?? null,
    forecastCompletion: completion?.date ?? null,
    baselineCompletion: completion?.baselineDate ?? null,
    targetCompletionDate: targetCompletionDate ?? null,
    toleranceWeeks,
    today: todayIso,
  });

  // Band 1's gate fact: the next gate from the snapshot, and the open actions
  // bearing on the current stage's gate, the Action Log's own computation.
  const { byId } = buildObjectiveIndex(orderedObjectives);
  const readiness = gateReadiness(actions ?? [], byId, currentStage);

  // Band 3's attention list: the one ranked, deduplicated read across the three
  // modules, composed over the same rows and the health engine's output. The
  // monitor reads today as epoch; the surface already handed it down as ISO.
  const attention = deriveAttention({
    risks: risks ?? [],
    actions: actions ?? [],
    health,
    objectivesById: byId,
    nowMs: Date.parse(todayIso),
  });

  return {
    health,
    rows: orderHealthRows(health.objectives),
    attention,
    facts: {
      currentStage,
      percentComplete: hasBaseline ? completeTile(progress).percent : null,
      forecastCompletion: completion?.date ?? null,
      targetCompletionDate: targetCompletionDate ?? null,
      nextGate: hasBaseline ? nextGate(programme, met) : null,
      readiness,
      hasBaseline,
    },
    toleranceWeeks,
  };
}
