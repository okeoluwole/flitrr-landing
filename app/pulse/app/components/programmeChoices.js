/**
 * Programme choices persistence (Step 7 Brief programme update, sub-step 1b).
 *
 * The read and write layer for the developer's programme choices against the
 * curated template (lib/engine/programmeTemplate.js). A choice is, per stage
 * gate, a chosen target date and an N/A flag; and per template milestone, a
 * chosen target date and an optional free note. Nothing else.
 *
 * Where it is stored, and why here:
 *   - Choices ride on the existing project_stage_gates rows (one per stage, 0
 *     to 7). The chosen gate date is the target_date column added in 015; the
 *     N/A flag (target_na) and the milestone choices (milestone_choices JSONB)
 *     are added in 019. This extends the existing Step 7 store rather than
 *     opening a parallel one, so the choices sit inside the Brief data the
 *     wizard reads and the existing project_briefs lock snapshot captures at
 *     lock. There is no separate programme snapshot.
 *   - Milestone choices are keyed by the milestone's stable key (not its
 *     display name, not its array position), so a choice stays bound to the
 *     right milestone even if the template array is reordered or a milestone is
 *     later renamed. The per-stage row holds an object keyed by that key:
 *     { "<key>": { target_date, note } }.
 *
 * What this layer does NOT do:
 *   - It does not derive advised dates. Advised dates are computed at read time
 *     by lib/engine/programmeSchedule.js from the project start and the
 *     template; they are never persisted. This layer stores choices only.
 *   - It does not compute criticality. That is sub-step 1d.
 *   - It owns no UI. Wiring these reads and writes into the wizard is sub-step
 *     1c.
 *
 * Shape note. The choices object mirrors the wizard's per-stage gate state so
 * it slots straight in later:
 *   {
 *     stages: [
 *       {
 *         id,            the project_stage_gates row id (null before load)
 *         stage,         0 to 7
 *         target_date,   '' or 'YYYY-MM-DD'   (the developer's chosen gate date)
 *         target_na,     boolean              (gate marked not applicable)
 *         milestones: {  keyed by the template milestone's stable key
 *           [key]: { target_date: '' | 'YYYY-MM-DD', note: '' | string }
 *         }
 *       }
 *     ]
 *   }
 * Empty controls are held as '' in memory and stored as null, matching the rest
 * of the wizard's persistence.
 *
 * The pure mapping functions (serialise, deserialise, defaults) carry the
 * round-trip and are unit-tested in isolation. The two async functions wrap
 * them in the repo's Supabase convention: the caller passes its already-awaited
 * client, and a read returns Supabase's { error } while a write returns the
 * first error or null.
 */

import { PROGRAMME_TEMPLATE } from '../../../../lib/engine/programmeTemplate.js';

// Trim an optional text or date field to a non-empty string, or null. Mirrors
// the wizard's clean(): an empty control value is stored as null, never ''.
function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Serialise a stage's in-memory milestone choices into the stored JSONB value.
 * A choice is kept only when the developer actually set a date or a note, and
 * only those two fields are ever written, so an advised date cannot leak in. A
 * stage with no real choices stores null rather than an empty object. Keyed by
 * the milestone's stable key throughout.
 */
export function serializeMilestoneChoices(milestones) {
  const out = {};
  for (const key of Object.keys(milestones ?? {})) {
    const choice = milestones[key] ?? {};
    const target_date = clean(choice.target_date);
    const note = clean(choice.note);
    // Both blank means the developer made no choice for this milestone, so do
    // not store a row for it.
    if (target_date == null && note == null) continue;
    out[key] = { target_date, note };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Read a stage's stored milestone choices back into the in-memory map the
 * controlled inputs use. Null or absent becomes an empty map; each stored
 * choice's null fields become '' for the inputs. Keyed by the stable key.
 */
export function deserializeMilestoneChoices(stored) {
  const out = {};
  const src = stored ?? {};
  for (const key of Object.keys(src)) {
    const choice = src[key] ?? {};
    out[key] = {
      target_date: choice.target_date ?? '',
      note: choice.note ?? '',
    };
  }
  return out;
}

/**
 * Map one project_stage_gates row onto a stage's programme choice: the chosen
 * gate date, the N/A flag, and the milestone choices keyed by stable key. Nulls
 * from the database become the empty values the controlled inputs expect.
 */
export function gateChoiceFromRow(row) {
  return {
    id: row?.id ?? null,
    stage: row?.stage,
    target_date: row?.target_date ?? '',
    target_na: row?.target_na === true,
    milestones: deserializeMilestoneChoices(row?.milestone_choices),
  };
}

/**
 * Deserialise the eight project_stage_gates rows into the project's programme
 * choices, in stage order. The read half of the layer's mapping.
 */
export function programmeChoicesFromRows(rows) {
  const stages = [...(rows ?? [])]
    .sort((a, b) => a.stage - b.stage)
    .map(gateChoiceFromRow);
  return { stages };
}

/**
 * Build the update payload for one stage's row from its programme choice: the
 * chosen date (null when blank), the N/A flag, and the serialised milestone
 * choices. Only these three programme fields are written, so the Gate module's
 * own columns (gate_status, passed_at, the rest) are never touched, exactly as
 * the existing gate-date save behaves. Advised dates are derived elsewhere and
 * are never part of this payload.
 */
export function gateRowPatch(stageChoice) {
  return {
    target_date: clean(stageChoice?.target_date),
    target_na: stageChoice?.target_na === true,
    milestone_choices: serializeMilestoneChoices(stageChoice?.milestones),
  };
}

/**
 * The empty programme choices for a project, one entry per template stage: no
 * gate date, not N/A, no milestone choices. The scaffold state the UI starts
 * from before anything is chosen, and what freshly seeded rows read back as.
 */
export function emptyProgrammeChoices(template = PROGRAMME_TEMPLATE) {
  const stages = (template?.stages ?? []).map((s) => ({
    id: null,
    stage: s.stage,
    target_date: '',
    target_na: false,
    milestones: {},
  }));
  return { stages };
}

/**
 * Read a single milestone's choice from a stage by its stable key, defaulting
 * to an empty choice. Looking choices up by key (never by array position) is
 * what keeps a choice bound to its milestone if the template array is reordered.
 */
export function getMilestoneChoice(stageChoice, key) {
  return stageChoice?.milestones?.[key] ?? { target_date: '', note: '' };
}

/**
 * Return a copy of the stage choice with one milestone's choice set, keyed by
 * its stable key. Immutable, so it slots into a React state update later.
 */
export function setMilestoneChoice(stageChoice, key, choice) {
  return {
    ...stageChoice,
    milestones: {
      ...(stageChoice?.milestones ?? {}),
      [key]: {
        target_date: choice?.target_date ?? '',
        note: choice?.note ?? '',
      },
    },
  };
}

// The columns this layer reads and writes: the chosen gate date (target_date,
// from 015) plus the two columns 019 adds. Held in one place so the read and
// write stay in step.
const GATE_CHOICE_COLUMNS = 'id, stage, target_date, target_na, milestone_choices';

/**
 * Load a project's stored programme choices from project_stage_gates. The async
 * read half of the layer. Follows the repo's persistence convention: it takes
 * the caller's already-awaited Supabase client and returns Supabase's { error }
 * alongside the deserialised choices (null on error).
 */
export async function loadProgrammeChoices(supabase, projectId) {
  const { data, error } = await supabase
    .from('project_stage_gates')
    .select(GATE_CHOICE_COLUMNS)
    .eq('project_id', projectId)
    .order('stage', { ascending: true });
  if (error) return { choices: null, error };
  return { choices: programmeChoicesFromRows(data ?? []), error: null };
}

/**
 * Save a project's programme choices: update each seeded stage row by id with
 * the chosen date, the N/A flag and the milestone choices. Mirrors the existing
 * gate-date save (update by id, only the programme fields), so the Gate module's
 * columns stay untouched. Returns the first Supabase error, or null on success.
 */
export async function saveProgrammeChoices(supabase, projectId, choices) {
  const stages = (choices?.stages ?? []).filter((s) => s.id);
  const results = await Promise.all(
    stages.map((s) =>
      supabase
        .from('project_stage_gates')
        .update(gateRowPatch(s))
        .eq('id', s.id)
        .eq('project_id', projectId)
    )
  );
  return results.find((r) => r.error)?.error ?? null;
}
