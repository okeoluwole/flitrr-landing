'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import StepProjectDefinition from './StepProjectDefinition';
import StepStrategicContext from './StepStrategicContext';
import StepScopeSite from './StepScopeSite';
import StepOrganisation from './StepOrganisation';
import StepProjectObjectives from './StepProjectObjectives';
import StepConstraintRanking from './StepConstraintRanking';
import StepItemList from './StepItemList';
import StepFinancialBaseline from './StepFinancialBaseline';
import StepProgramme from './StepProgramme';
import StepGeneratedBrief from './StepGeneratedBrief';
import { OBJECTIVE_ORDER } from './objectiveMeta';
import {
  LIST_CONFIG,
  CONFIG_BY_STEP,
  cascadeCriticality,
} from './listStepConfig';
import styles from './InitiationWizard.module.css';

/**
 * InitiationWizard, the nine-step PULSE Project Initiation flow.
 *
 * The widened nine-step flow. Steps 3 (Scope and Site) and 6 (Financial
 * Baseline) are navigable placeholders for now; step 4 holds the workstreams
 * list until the parties, the authority and the cadence are added; step 5
 * merges the objective definitions and the priority ranking. The rest are built.
 * Architecture decisions:
 *
 *   - One route, one wizard. The progress indicator shows all nine steps.
 *   - The project row is created on advancing from Step 1 (INSERT), which
 *     fires handle_new_project() to seed objectives and stage gates.
 *   - Per-step saving: Steps 1 and 2 write to `projects` on advance, so a
 *     half-finished setup is a resumable draft.
 *   - Navigation is linear-forward, free-backward. The user advances one
 *     step at a time and cannot jump past the furthest step reached, but
 *     can always go back to revise.
 *   - Resumable URL: once the project exists, the URL carries ?project=<id>
 *     so a refresh or return visit lands back in this project's setup.
 *
 * Validation is light by design: only `name` is required to create the
 * project. Everything else is optional at entry. Full completeness is a
 * Gate 1 to 2 concern, handled in a later sub-step.
 */

// The nine steps. `short` labels the progress node; `name` titles the panel
// and the node's accessible label. Every step renders its own form.
// Objectives and Priority leads the body steps, before Scope and Organisation,
// so the classification is set before the workstreams, milestones and risks
// that cascade from it.
const STEPS = [
  { n: 1, name: 'Project Definition', short: 'Define' },
  { n: 2, name: 'Strategic Context', short: 'Context' },
  { n: 3, name: 'Objectives and Priority', short: 'Objectives' },
  { n: 4, name: 'Scope and Site', short: 'Scope' },
  { n: 5, name: 'Organisation and Governance', short: 'Organisation' },
  { n: 6, name: 'Financial Baseline', short: 'Financial' },
  { n: 7, name: 'Programme', short: 'Programme' },
  {
    n: 8,
    name: 'Risks, Assumptions, Constraints and Dependencies',
    short: 'Risks',
  },
  { n: 9, name: 'Generated Brief', short: 'Brief' },
];

const TOTAL_STEPS = STEPS.length;

const EMPTY_DEF = {
  name: '',
  project_type: '',
  category: '',
  sub_category: '',
  description: '',
  // Location is the city (in `location`) plus the country, the jurisdiction
  // the later steps tailor to (framework Section 7). country is the
  // project_country enum, nullable, so it defaults to empty (maps to null).
  location: '',
  country: '',
  // Size: structured measures (assembled into the size_measures JSONB on save,
  // see buildSizeMeasures) plus the legacy free-text `size` summary the brief
  // still reads. All held as strings for the controlled inputs.
  size: '',
  size_unit_count: '',
  size_gross_internal_area: '',
  size_plot_size: '',
  size_storeys: '',
  procurement_route: '',
  funding_structure: '',
  start_date: '',
  target_completion_date: '',
  // Optional headline financials (M3.5 Phase A). Held as strings for the
  // controlled inputs; numerics are parsed on save (see cleanNumeric).
  // currency is a constrained enum, NOT NULL in the schema, so it defaults
  // to GBP rather than empty.
  currency: 'GBP',
  budget: '',
  projected_gdv: '',
  projected_roi: '',
  financial_detail_url: '',
};

const EMPTY_CTX = {
  strategic_rationale: '',
  target_end_user: '',
  exit_strategy: '',
  strategic_alignment: '',
};

// Step 4 Scope and Site, the scalar fields of the project_scope_site 1:1
// record. The mix and quantum is held separately as a list of rows (see
// scopeFrom). planning_status is the enum, empty mapping to null on save.
const EMPTY_SCOPE = {
  development_summary: '',
  spec_standard: '',
  site_area: '',
  planning_status: '',
  planning_constraints: '',
  physical_constraints: '',
};

// Step 5 Organisation and Governance, the scalar governance fields held on the
// projects row. The named authority is held by the chosen party's client key
// (authority_key) and resolved to projects.authority_stakeholder_id on save,
// since a freshly added party has no database id yet. The parties themselves
// are a separate list (see the stakeholders state).
const EMPTY_ORG = {
  reporting_cadence: '',
  digest_recipient: '',
  authority_key: '',
};

const SAVE_ERROR =
  'We could not save this step. Please check your connection and try again, or email hello@flitrr.com.';

// Lifecycle stage names (framework Section 4), for the header stage indicator.
const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

// Short date for the gate decision note, e.g. "5 Jun 2026".
function formatGateDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Normalise an optional field for the database: trim, and treat an empty
 * string as null. This matters beyond tidiness for the typed columns:
 * an empty string is invalid input for a DATE column (start_date,
 * target_completion_date) and for the procurement_route enum, so those
 * must be sent as null, not ''.
 */
function clean(v) {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/**
 * Normalise an optional numeric field for a NUMERIC column. Empty is null.
 * Anything else is stripped of currency symbols, thousands separators and
 * spaces, then parsed: a finite number is stored, anything unparseable
 * becomes null rather than erroring. Permissive by design, consistent with
 * the rest of the flow: a stray character never blocks a save, it just does
 * not persist a figure. Negatives are not expected here but are preserved if
 * entered, since the brief never computes on these values.
 */
function cleanNumeric(v) {
  if (v == null) return null;
  const stripped = String(v).replace(/[^0-9.-]/g, '');
  if (stripped === '' || stripped === '-' || stripped === '.') return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

/**
 * Assemble the four structured size fields into the size_measures JSONB.
 * Each measure is kept as the developer typed it (permissive, like the rest
 * of the flow: "1,800 sqm", "0.6 ha"); only the non-empty ones are carried,
 * and an all-empty set stores null rather than an empty object, so the column
 * stays clean. The legacy free-text summary is saved separately on `size`.
 */
function buildSizeMeasures(def) {
  const measures = {
    unit_count: clean(def.size_unit_count),
    gross_internal_area: clean(def.size_gross_internal_area),
    plot_size: clean(def.size_plot_size),
    storeys: clean(def.size_storeys),
  };
  const filled = Object.fromEntries(
    Object.entries(measures).filter(([, v]) => v != null)
  );
  return Object.keys(filled).length > 0 ? filled : null;
}

/**
 * Assemble the Step 4 mix-and-quantum rows into the mix_quantum JSONB array.
 * A row counts if either its label or its quantum is filled; blank rows are
 * dropped, and an empty list stores null rather than an empty array. The
 * client-only _key is never persisted.
 */
function buildMixQuantum(mix) {
  const rows = (mix ?? [])
    .map((r) => ({ label: clean(r.label), quantum: clean(r.quantum) }))
    .filter((r) => r.label != null || r.quantum != null);
  return rows.length > 0 ? rows : null;
}

/**
 * Assemble the three budget-breakdown cost fields into the budget_breakdown
 * JSONB. Each is parsed as money (cleanNumeric); only the filled ones are
 * carried, and an all-empty breakdown stores null rather than an empty object.
 */
function buildBreakdown(financial) {
  const bd = {
    hard_cost: cleanNumeric(financial.hard_cost),
    soft_cost: cleanNumeric(financial.soft_cost),
    contingency: cleanNumeric(financial.contingency),
  };
  const filled = Object.fromEntries(
    Object.entries(bd).filter(([, v]) => v != null)
  );
  return Object.keys(filled).length > 0 ? filled : null;
}

// Map a stored projects row onto Step 1 / Step 2 field state. DATE
// columns come back as 'YYYY-MM-DD' strings, which is exactly what
// <input type="date"> expects.
function defFrom(p) {
  if (!p) return { ...EMPTY_DEF };
  return {
    name: p.name ?? '',
    project_type: p.project_type ?? '',
    category: p.category ?? '',
    sub_category: p.sub_category ?? '',
    description: p.description ?? '',
    location: p.location ?? '',
    country: p.country ?? '',
    // size_measures is a JSONB object (or null); unpack its keys onto the flat
    // controlled fields. The legacy free-text summary stays in `size`.
    size: p.size ?? '',
    size_unit_count: p.size_measures?.unit_count ?? '',
    size_gross_internal_area: p.size_measures?.gross_internal_area ?? '',
    size_plot_size: p.size_measures?.plot_size ?? '',
    size_storeys: p.size_measures?.storeys ?? '',
    procurement_route: p.procurement_route ?? '',
    funding_structure: p.funding_structure ?? '',
    start_date: p.start_date ?? '',
    target_completion_date: p.target_completion_date ?? '',
    // NUMERIC columns come back as numbers (or strings); render them as
    // plain strings for the inputs. null becomes an empty field.
    currency: p.currency ?? 'GBP',
    budget: p.budget != null ? String(p.budget) : '',
    projected_gdv: p.projected_gdv != null ? String(p.projected_gdv) : '',
    projected_roi: p.projected_roi != null ? String(p.projected_roi) : '',
    financial_detail_url: p.financial_detail_url ?? '',
  };
}

function ctxFrom(p) {
  if (!p) return { ...EMPTY_CTX };
  return {
    strategic_rationale: p.strategic_rationale ?? '',
    target_end_user: p.target_end_user ?? '',
    exit_strategy: p.exit_strategy ?? '',
    strategic_alignment: p.strategic_alignment ?? '',
  };
}

// Map a project_scope_site row (or null, for a project predating the seed)
// onto Step 4 state. The mix_quantum JSONB array becomes editable rows, each
// given a stable client key for React and focus. A missing or malformed
// mix_quantum is treated as no rows.
function scopeFrom(row, makeKey) {
  if (!row) return { ...EMPTY_SCOPE, mix: [] };
  return {
    development_summary: row.development_summary ?? '',
    spec_standard: row.spec_standard ?? '',
    site_area: row.site_area ?? '',
    planning_status: row.planning_status ?? '',
    planning_constraints: row.planning_constraints ?? '',
    physical_constraints: row.physical_constraints ?? '',
    mix: Array.isArray(row.mix_quantum)
      ? row.mix_quantum.map((m) => ({
          _key: makeKey(),
          label: m?.label ?? '',
          quantum: m?.quantum ?? '',
        }))
      : [],
  };
}

// Map the projects row onto the Step 5 governance fields. The authority key is
// left empty here and resolved once the parties load (it maps the stored
// authority_stakeholder_id to that party's client key).
function orgFrom(p) {
  if (!p) return { ...EMPTY_ORG };
  return {
    reporting_cadence: p.reporting_cadence ?? '',
    digest_recipient: p.digest_recipient ?? '',
    authority_key: '',
  };
}

// Map the project_budget row (or null) and the funding-milestone rows onto the
// Step 6 state. The breakdown's numeric values render as plain strings for the
// controlled inputs; each milestone gets a stable client key.
function financialFrom(budgetRow, milestoneRows, makeKey) {
  const bd = budgetRow?.budget_breakdown ?? {};
  return {
    hard_cost: bd?.hard_cost != null ? String(bd.hard_cost) : '',
    soft_cost: bd?.soft_cost != null ? String(bd.soft_cost) : '',
    contingency: bd?.contingency != null ? String(bd.contingency) : '',
    funding_structure_type: budgetRow?.funding_structure_type ?? '',
    funding_notes: budgetRow?.funding_notes ?? '',
    milestones: (milestoneRows ?? []).map((r) => ({
      _key: makeKey(),
      id: r.id,
      label: r.label ?? '',
      amount: r.amount != null ? String(r.amount) : '',
      target_date: r.target_date ?? '',
      status: r.status ?? 'planned',
      note: r.note ?? '',
    })),
  };
}

// Map the eight seeded project_stage_gates rows onto Step 7 state, in stage
// order. Only the stage, the row id, and the target_date are needed here; the
// gate status the Gate module owns is read and written elsewhere, never touched
// by this step.
function gatesFrom(rows) {
  return [...(rows ?? [])]
    .sort((a, b) => a.stage - b.stage)
    .map((r) => ({
      id: r.id,
      stage: r.stage,
      target_date: r.target_date ?? '',
    }));
}

// Map the fetched project_objectives rows onto Step 3 field state, in the
// canonical objective order (Scope, Cost, Time, Quality, Funding). Nulls
// from the database become empty strings for the controlled inputs.
function objectivesFrom(rows) {
  return OBJECTIVE_ORDER.map((type) => {
    const r = rows.find((row) => row.objective_type === type) ?? {};
    return {
      id: r.id ?? null,
      objective_type: type,
      definition: r.definition ?? '',
      classification: r.classification ?? 'flexible',
      tolerance: r.tolerance ?? '',
      rank: r.rank ?? null,
    };
  });
}

// Derive the Step 4 ranking order from the rows. If every row has a saved
// rank (a returning draft), honour that order. Otherwise (freshly seeded,
// ranks still null) fall back to the canonical order for the developer to
// rearrange.
function rankOrderFrom(rows) {
  const ranked = rows
    .filter((r) => r.rank != null)
    .sort((a, b) => a.rank - b.rank);
  if (ranked.length === OBJECTIVE_ORDER.length) {
    return ranked.map((r) => r.objective_type);
  }
  return [...OBJECTIVE_ORDER];
}

// ── Step 5 to 7 list helpers ───────────────────────────────────────────────
// The three list steps (milestones, workstreams, risks) share one shape, so
// these generic helpers drive all of them from the per-type LIST_CONFIG. A
// screen item carries: a real database `id` (null until inserted), a stable
// client `_key` (for React and focus, never persisted), the config's fields,
// `linked_objective_id`, `criticality`, and an in-session `criticalityOverridden`
// flag (no schema column for it, by design).

// Default value for a field on a brand-new (blank) item.
function fieldDefault(field) {
  if (field.type === 'select') return field.default ?? field.options[0].value;
  return '';
}

// A fresh, unsaved item: no id, unlinked, Standard, fields at their defaults.
function makeEmptyItem(cfg, makeKey) {
  const item = {
    id: null,
    _key: makeKey(),
    linked_objective_id: '',
    criticality: 'standard',
    criticalityOverridden: false,
  };
  for (const f of cfg.fields) item[f.name] = fieldDefault(f);
  return item;
}

// Map a saved database row onto a screen item. The override flag is
// reconstructed: a stored criticality that diverges from what the cascade
// would currently produce can only have come from a manual override, so a
// later link change must not silently reset it. A value that matches the
// cascade leaves the cascade live.
function rowToItem(cfg, row, objectives, makeKey) {
  const item = {
    id: row.id,
    _key: makeKey(),
    linked_objective_id: row.linked_objective_id ?? '',
    criticality: row.criticality,
    criticalityOverridden:
      row.criticality !==
      cascadeCriticality(row.linked_objective_id ?? '', objectives),
  };
  for (const f of cfg.fields) {
    item[f.name] = row[f.name] ?? (f.type === 'select' ? fieldDefault(f) : '');
  }
  return item;
}

// Build a step's initial list: saved rows if any exist, otherwise the
// suggested starter set (each suggestion merged onto a blank item).
function buildList(cfg, rows, objectives, makeKey) {
  if (rows && rows.length > 0) {
    return rows.map((row) => rowToItem(cfg, row, objectives, makeKey));
  }
  return cfg.suggested.map((s) => ({ ...makeEmptyItem(cfg, makeKey), ...s }));
}

// An item is "blank" when its required (identity) field is empty after
// trimming. Blank items are not persisted (the column is NOT NULL) and are
// dropped from the screen on save, so the screen matches the database.
function isBlank(cfg, item) {
  return clean(item[cfg.requiredField]) == null;
}

// Map a screen item onto a database row payload (insert or update). Optional
// text and date fields are cleaned to null when empty; selects (the risk
// levels) always carry a value. id, _key, status, and the override flag are
// intentionally not sent: id/_key are identity, status keeps its default, and
// the override flag is in-session only.
function itemToRow(cfg, item) {
  const row = {};
  for (const f of cfg.fields) {
    row[f.name] = f.type === 'select' ? item[f.name] : clean(item[f.name]);
  }
  row.linked_objective_id = item.linked_objective_id || null;
  row.criticality = item.criticality;
  return row;
}

export default function InitiationWizard({
  userId,
  initialProject,
  initialGate = null,
}) {
  const supabase = createClient();

  // Current lifecycle stage for this project. The Stage 1 to 2 gate (a
  // separate screen) is what advances it; within the wizard it does not
  // change, so it is read straight from the loaded row. Drives the post-gate
  // unlock block on Step 8 and the header stage indicator.
  const currentStage = initialProject?.current_stage ?? 1;

  // Once the Stage 1 to 2 gate has committed the baseline (the project is at
  // Stage 2, or the gate row is recorded passed), Steps 3 and 4 are frozen:
  // the objective definitions, their classification, and their ranking can no
  // longer be edited here. This is the minimal expression of the locked-
  // baseline principle. The Risk module derives criticality live from these
  // objectives, so an ad hoc change post-gate would silently move monitoring
  // decisions. Revising a committed baseline is a re-baseline, a separate
  // milestone that is not yet built. Mirrors the post-gate unlock block on
  // Step 8.
  const objectivesFrozen =
    currentStage >= 2 || initialGate?.gate_status === 'passed';

  const [projectId, setProjectId] = useState(initialProject?.id ?? null);
  const [step, setStep] = useState(1);
  // Furthest step reached. A resumed draft has, by definition, completed
  // Step 1 (the project exists), so Step 2 is reachable. We can't know if
  // an earlier session went further into the data steps, and it does not
  // matter: the wizard re-loads their data and the user can re-walk forward.
  // An active project has been through to the brief and locked it at least
  // once, so open every step, letting the user jump straight to Step 8.
  const [maxReached, setMaxReached] = useState(
    initialProject?.status === 'active'
      ? TOTAL_STEPS
      : initialProject
        ? 2
        : 1
  );
  const [def, setDef] = useState(() => defFrom(initialProject));
  const [ctx, setCtx] = useState(() => ctxFrom(initialProject));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Step 3 / 4 state. The five objective rows are loaded client-side once
  // the project exists (see the effect below). objectives holds the
  // editable fields in canonical order; rankOrder is the Step 4 priority
  // order (an array of objective_type strings); objStatus gates the forms
  // until the rows are in hand.
  const [objectives, setObjectives] = useState(null);
  const [rankOrder, setRankOrder] = useState(null);
  const [objStatus, setObjStatus] = useState('idle'); // idle | loading | loaded | error
  const objLoadStartedRef = useRef(null);

  // Step 4 Scope and Site state. The 1:1 project_scope_site record loads once
  // the project exists. scope holds the scalar fields plus the editable mix
  // rows; scopeStatus gates the form until the row (or its absence) is known.
  const [scope, setScope] = useState(null);
  const [scopeStatus, setScopeStatus] = useState('idle'); // idle | loading | loaded | error
  const scopeLoadStartedRef = useRef(null);

  // Step 5 Organisation and Governance state. org holds the scalar governance
  // fields (initialised from the projects row); stakeholders is the editable
  // parties list, loaded once the project exists. stakeholdersStatus gates the
  // step, and persistedStakeholderIdsRef tracks which party ids are in the
  // database so a save computes deletes precisely (as the lists do).
  const [org, setOrg] = useState(() => orgFrom(initialProject));
  const [stakeholders, setStakeholders] = useState([]);
  const [stakeholdersStatus, setStakeholdersStatus] = useState('idle'); // idle | loading | loaded | error
  const stakeholderLoadStartedRef = useRef(null);
  const persistedStakeholderIdsRef = useRef(new Set());

  // Step 6 Financial Baseline state. The project_budget 1:1 record plus the
  // funding milestones load once the project exists. financial holds the
  // breakdown, the funding structure and notes, and the milestones list;
  // financialStatus gates the step, and persistedFmIdsRef tracks the saved
  // milestone ids so a save computes deletes precisely.
  const [financial, setFinancial] = useState(null);
  const [financialStatus, setFinancialStatus] = useState('idle'); // idle | loading | loaded | error
  const financialLoadStartedRef = useRef(null);
  const persistedFmIdsRef = useRef(new Set());

  // Step 7 Programme state. The eight stage-gate rows load once the project
  // exists; gates holds their stage, id and target_date, and gatesStatus gates
  // the step. The milestones reuse the shared list state (lists.milestones).
  const [gates, setGates] = useState(null);
  const [gatesStatus, setGatesStatus] = useState('idle'); // idle | loading | loaded | error
  const gatesLoadStartedRef = useRef(null);

  // Step 5 to 7 state. The three lists load once the project exists and its
  // objectives are in hand (the link selector and the cascade need them).
  // `lists` holds { milestones, workstreams, risks } once loaded; listsStatus
  // gates the forms. persistedIdsRef tracks which item ids currently exist in
  // the database, so a save computes deletes precisely. keyCounterRef mints
  // the stable per-item client keys (React keys and focus targets).
  const [lists, setLists] = useState(null);
  const [listsStatus, setListsStatus] = useState('idle'); // idle | loading | loaded | error
  const listLoadStartedRef = useRef(null);
  const keyCounterRef = useRef(0);
  const persistedIdsRef = useRef({
    milestones: new Set(),
    workstreams: new Set(),
    risks: new Set(),
    assumptions: new Set(),
    constraints: new Set(),
    dependencies: new Set(),
  });
  const makeKey = () => `k${keyCounterRef.current++}`;

  const nameValid = def.name.trim().length > 0;

  const onDefChange = (field, value) => {
    setDef((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const onCtxChange = (field, value) => {
    setCtx((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  // Step 4 Scope and Site edits. The scalar fields go through onScopeChange;
  // the mix-and-quantum rows have their own add / edit / remove, each keyed by
  // the row's stable client key.
  const onScopeChange = (field, value) => {
    setScope((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (error) setError(null);
  };

  const onMixField = (key, field, value) => {
    setScope((prev) =>
      prev
        ? {
            ...prev,
            mix: prev.mix.map((r) =>
              r._key === key ? { ...r, [field]: value } : r
            ),
          }
        : prev
    );
    if (error) setError(null);
  };

  const onMixAdd = () => {
    setScope((prev) =>
      prev
        ? { ...prev, mix: [...prev.mix, { _key: makeKey(), label: '', quantum: '' }] }
        : prev
    );
    if (error) setError(null);
  };

  const onMixRemove = (key) => {
    setScope((prev) =>
      prev ? { ...prev, mix: prev.mix.filter((r) => r._key !== key) } : prev
    );
    if (error) setError(null);
  };

  // Step 5 Organisation and Governance edits. The scalar governance fields go
  // through onOrgChange; the parties have their own add / edit / remove. The
  // authority is held by client key, so removing the chosen party clears it.
  const onOrgChange = (field, value) => {
    setOrg((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const onPartyField = (key, field, value) => {
    setStakeholders((prev) =>
      prev.map((p) => (p._key === key ? { ...p, [field]: value } : p))
    );
    if (error) setError(null);
  };

  const onPartyAdd = () => {
    setStakeholders((prev) => [
      ...prev,
      { _key: makeKey(), id: null, name: '', organisation: '', role: 'developer', contact: '' },
    ]);
    if (error) setError(null);
  };

  const onPartyRemove = (key) => {
    setStakeholders((prev) => prev.filter((p) => p._key !== key));
    setOrg((prev) =>
      prev.authority_key === key ? { ...prev, authority_key: '' } : prev
    );
    if (error) setError(null);
  };

  // Step 6 Financial Baseline edits. The breakdown and funding fields go
  // through onFinancialChange; the funding milestones have their own add / edit
  // / remove. The headline figures (currency, budget, GDV, ROI, appraisal link)
  // stay on `def` and use onDefChange, since they live on the projects row.
  const onFinancialChange = (field, value) => {
    setFinancial((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (error) setError(null);
  };

  const onFmField = (key, field, value) => {
    setFinancial((prev) =>
      prev
        ? {
            ...prev,
            milestones: prev.milestones.map((m) =>
              m._key === key ? { ...m, [field]: value } : m
            ),
          }
        : prev
    );
    if (error) setError(null);
  };

  const onFmAdd = () => {
    setFinancial((prev) =>
      prev
        ? {
            ...prev,
            milestones: [
              ...prev.milestones,
              {
                _key: makeKey(),
                id: null,
                label: '',
                amount: '',
                target_date: '',
                status: 'planned',
                note: '',
              },
            ],
          }
        : prev
    );
    if (error) setError(null);
  };

  const onFmRemove = (key) => {
    setFinancial((prev) =>
      prev
        ? { ...prev, milestones: prev.milestones.filter((m) => m._key !== key) }
        : prev
    );
    if (error) setError(null);
  };

  // Step 7 Programme edit: set a stage gate's target date, located by its stage.
  const onGateDateChange = (stage, value) => {
    setGates((prev) =>
      prev
        ? prev.map((g) => (g.stage === stage ? { ...g, target_date: value } : g))
        : prev
    );
    if (error) setError(null);
  };

  // Fetch the five seeded objective rows for the current project. Used
  // both by the load effect and by the retry control if the fetch fails.
  const loadObjectives = async () => {
    if (!projectId) return;
    setObjStatus('loading');
    const { data, error: selErr } = await supabase
      .from('project_objectives')
      .select('id, objective_type, definition, classification, tolerance, rank')
      .eq('project_id', projectId);
    if (selErr || !data || data.length < OBJECTIVE_ORDER.length) {
      setObjStatus('error');
      return;
    }
    setObjectives(objectivesFrom(data));
    setRankOrder(rankOrderFrom(data));
    setObjStatus('loaded');
  };

  // Load objectives once the project exists. Keyed on projectId so it
  // fires on mount for a resumed draft and right after the Step 1 INSERT
  // for a new project (the trigger has seeded the rows by then). The ref
  // guards against a duplicate fetch from React's double effect run in
  // development StrictMode.
  useEffect(() => {
    if (!projectId) return;
    if (objLoadStartedRef.current === projectId) return;
    objLoadStartedRef.current = projectId;
    loadObjectives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch the Step 4 scope and site record. maybeSingle: a project created
  // before migration 015 has no seeded row, which is not an error; it loads as
  // empty and the save upserts it. Used by the load effect and the retry.
  const loadScopeSite = async () => {
    if (!projectId) return;
    setScopeStatus('loading');
    const { data, error: selErr } = await supabase
      .from('project_scope_site')
      .select(
        'development_summary, mix_quantum, spec_standard, site_area, planning_status, planning_constraints, physical_constraints'
      )
      .eq('project_id', projectId)
      .maybeSingle();
    if (selErr) {
      setScopeStatus('error');
      return;
    }
    setScope(scopeFrom(data, makeKey));
    setScopeStatus('loaded');
  };

  // Load the scope and site record once the project exists. Independent of the
  // objectives load (nothing here reads them), so it has its own ref guard.
  useEffect(() => {
    if (!projectId) return;
    if (scopeLoadStartedRef.current === projectId) return;
    scopeLoadStartedRef.current = projectId;
    loadScopeSite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch the Step 5 parties. Independent of objectives and lists (nothing here
  // reads them). After loading, resolve the project's stored named authority to
  // that party's client key, so the authority select shows the saved choice.
  const loadStakeholders = async () => {
    if (!projectId) return;
    setStakeholdersStatus('loading');
    const { data, error: selErr } = await supabase
      .from('project_stakeholders')
      .select('id, name, organisation, role, contact')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (selErr) {
      setStakeholdersStatus('error');
      return;
    }
    const items = (data ?? []).map((row) => ({
      _key: makeKey(),
      id: row.id,
      name: row.name ?? '',
      organisation: row.organisation ?? '',
      role: row.role ?? 'developer',
      contact: row.contact ?? '',
    }));
    setStakeholders(items);
    persistedStakeholderIdsRef.current = new Set((data ?? []).map((x) => x.id));
    const authId = initialProject?.authority_stakeholder_id ?? null;
    if (authId) {
      const match = items.find((it) => it.id === authId);
      if (match) setOrg((prev) => ({ ...prev, authority_key: match._key }));
    }
    setStakeholdersStatus('loaded');
  };

  useEffect(() => {
    if (!projectId) return;
    if (stakeholderLoadStartedRef.current === projectId) return;
    stakeholderLoadStartedRef.current = projectId;
    loadStakeholders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch the Step 6 budget record and its funding milestones. maybeSingle for
  // the budget: a project predating migration 015 has no seeded row, which is
  // not an error (it loads empty and the save upserts).
  const loadFinancial = async () => {
    if (!projectId) return;
    setFinancialStatus('loading');
    const [b, m] = await Promise.all([
      supabase
        .from('project_budget')
        .select('budget_breakdown, funding_structure_type, funding_notes')
        .eq('project_id', projectId)
        .maybeSingle(),
      supabase
        .from('project_funding_milestones')
        .select('id, label, amount, target_date, status, note')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
    ]);
    if (b.error || m.error) {
      setFinancialStatus('error');
      return;
    }
    setFinancial(financialFrom(b.data, m.data, makeKey));
    persistedFmIdsRef.current = new Set((m.data ?? []).map((x) => x.id));
    setFinancialStatus('loaded');
  };

  useEffect(() => {
    if (!projectId) return;
    if (financialLoadStartedRef.current === projectId) return;
    financialLoadStartedRef.current = projectId;
    loadFinancial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch the eight seeded stage-gate rows for Step 7. Like the objectives,
  // these are seeded for every project, so fewer than eight means a load
  // problem rather than an empty state.
  const loadGates = async () => {
    if (!projectId) return;
    setGatesStatus('loading');
    const { data, error: selErr } = await supabase
      .from('project_stage_gates')
      .select('id, stage, target_date')
      .eq('project_id', projectId)
      .order('stage', { ascending: true });
    if (selErr || !data || data.length < 8) {
      setGatesStatus('error');
      return;
    }
    setGates(gatesFrom(data));
    setGatesStatus('loaded');
  };

  useEffect(() => {
    if (!projectId) return;
    if (gatesLoadStartedRef.current === projectId) return;
    gatesLoadStartedRef.current = projectId;
    loadGates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch the three list types for the current project. Kept separate from
  // the objectives load so Steps 3 and 4 keep their own ready/error gating,
  // but it runs only after objectives are loaded: the cascade default and the
  // override reconstruction both read objective classifications.
  const loadLists = async (objs) => {
    if (!projectId) return;
    setListsStatus('loading');
    const [m, w, r, a, c, d] = await Promise.all([
      supabase
        .from('project_milestones')
        .select(
          'id, name, description, target_date, linked_objective_id, criticality'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_workstreams')
        .select('id, name, description, lead, linked_objective_id, criticality')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_risks')
        .select(
          'id, description, likelihood, impact, linked_objective_id, criticality, mitigation'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_assumptions')
        .select('id, description, detail, linked_objective_id, criticality')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_constraints')
        .select('id, description, detail, linked_objective_id, criticality')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_dependencies')
        .select('id, description, detail, linked_objective_id, criticality')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
    ]);
    if (m.error || w.error || r.error || a.error || c.error || d.error) {
      setListsStatus('error');
      return;
    }
    setLists({
      milestones: buildList(LIST_CONFIG.milestones, m.data ?? [], objs, makeKey),
      workstreams: buildList(
        LIST_CONFIG.workstreams,
        w.data ?? [],
        objs,
        makeKey
      ),
      risks: buildList(LIST_CONFIG.risks, r.data ?? [], objs, makeKey),
      assumptions: buildList(
        LIST_CONFIG.assumptions,
        a.data ?? [],
        objs,
        makeKey
      ),
      constraints: buildList(
        LIST_CONFIG.constraints,
        c.data ?? [],
        objs,
        makeKey
      ),
      dependencies: buildList(
        LIST_CONFIG.dependencies,
        d.data ?? [],
        objs,
        makeKey
      ),
    });
    persistedIdsRef.current = {
      milestones: new Set((m.data ?? []).map((x) => x.id)),
      workstreams: new Set((w.data ?? []).map((x) => x.id)),
      risks: new Set((r.data ?? []).map((x) => x.id)),
      assumptions: new Set((a.data ?? []).map((x) => x.id)),
      constraints: new Set((c.data ?? []).map((x) => x.id)),
      dependencies: new Set((d.data ?? []).map((x) => x.id)),
    };
    setListsStatus('loaded');
  };

  // Load the lists once, after the objectives have loaded for this project.
  // Keyed on objStatus so it fires as soon as objectives are ready; the ref
  // guard keeps it to a single run per project.
  useEffect(() => {
    if (!projectId) return;
    if (objStatus !== 'loaded') return;
    if (listLoadStartedRef.current === projectId) return;
    listLoadStartedRef.current = projectId;
    loadLists(objectives);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, objStatus]);

  // On step change, return to the top of the page. Advancing from the Next
  // button at the foot of a long step would otherwise leave the next step
  // scrolled to its base.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [step]);

  const onObjectiveChange = (type, field, value) => {
    setObjectives((prev) =>
      prev
        ? prev.map((o) =>
            o.objective_type === type ? { ...o, [field]: value } : o
          )
        : prev
    );
    if (error) setError(null);
  };

  // Step 4 reorder: swap a row one place up or down (the accessible path).
  const moveObjective = (type, dir) => {
    setRankOrder((prev) => {
      if (!prev) return prev;
      const i = prev.indexOf(type);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // Step 4 reorder: accept a full new order (the drag-and-drop path).
  const onReorder = (next) => {
    setRankOrder(next);
  };

  // ── Step 5 to 7 list editing ──────────────────────────────────────────
  // Replace one item in one list, located by its stable client key.
  const updateListItem = (key, itemKey, fn) =>
    setLists((prev) =>
      prev
        ? {
            ...prev,
            [key]: prev[key].map((it) => (it._key === itemKey ? fn(it) : it)),
          }
        : prev
    );

  const onListField = (key, itemKey, field, value) => {
    updateListItem(key, itemKey, (it) => ({ ...it, [field]: value }));
    if (error) setError(null);
  };

  // Changing the linked objective re-applies the cascade default, unless the
  // developer has manually overridden this item's criticality.
  const onListLink = (key, itemKey, value) => {
    updateListItem(key, itemKey, (it) => {
      const next = { ...it, linked_objective_id: value };
      if (!it.criticalityOverridden) {
        next.criticality = cascadeCriticality(value, objectives);
      }
      return next;
    });
    if (error) setError(null);
  };

  // A manual criticality change sticks: it sets the override flag so a later
  // link change will not silently reset it.
  const onListCriticality = (key, itemKey, value) => {
    updateListItem(key, itemKey, (it) => ({
      ...it,
      criticality: value,
      criticalityOverridden: true,
    }));
    if (error) setError(null);
  };

  const onListAdd = (key) => {
    setLists((prev) =>
      prev
        ? {
            ...prev,
            [key]: [...prev[key], makeEmptyItem(LIST_CONFIG[key], makeKey)],
          }
        : prev
    );
    if (error) setError(null);
  };

  const onListRemove = (key, itemKey) => {
    setLists((prev) =>
      prev
        ? { ...prev, [key]: prev[key].filter((it) => it._key !== itemKey) }
        : prev
    );
    if (error) setError(null);
  };

  // Retry control for the Steps 5 to 7 load fallback. Retries whichever load
  // failed: objectives first (the lists load depends on it), otherwise the
  // lists themselves.
  const retryListData = () => {
    if (objStatus !== 'loaded') {
      objLoadStartedRef.current = null;
      loadObjectives();
      return;
    }
    if (stakeholdersStatus !== 'loaded') {
      stakeholderLoadStartedRef.current = null;
      loadStakeholders();
    }
    if (gatesStatus !== 'loaded') {
      gatesLoadStartedRef.current = null;
      loadGates();
    }
    if (listsStatus !== 'loaded') {
      loadLists(objectives);
    }
  };

  const advanceTo = (n) => {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
  };

  // Save Step 1. INSERT the project the first time (firing the seed
  // trigger), UPDATE it thereafter. Returns a Supabase error or null.
  const persistStep1 = async () => {
    const payload = {
      name: def.name.trim(),
      project_type: clean(def.project_type),
      category: clean(def.category),
      sub_category: clean(def.sub_category),
      description: clean(def.description),
      location: clean(def.location),
      country: clean(def.country),
      // Structured measures into the JSONB; the free-text summary on `size`.
      size: clean(def.size),
      size_measures: buildSizeMeasures(def),
      procurement_route: clean(def.procurement_route),
      start_date: clean(def.start_date),
      target_completion_date: clean(def.target_completion_date),
      // The headline financials and the funding structure now live on Step 6
      // (Financial Baseline) and are saved by persistFinancial, so they are no
      // longer written here. currency stays on the projects row with a NOT NULL
      // GBP default, so omitting it from this insert is safe.
    };

    if (!projectId) {
      // First save: create the row. status (draft) and current_stage (1)
      // come from schema defaults; the AFTER INSERT trigger seeds the 5
      // objectives and 8 stage gates.
      const { data, error: insErr } = await supabase
        .from('projects')
        .insert({ user_id: userId, ...payload })
        .select('id')
        .single();
      if (insErr) return insErr;

      setProjectId(data.id);
      // Make the draft resumable on refresh without a navigation that
      // would re-render this component and disturb its live state.
      if (typeof window !== 'undefined') {
        window.history.replaceState(
          null,
          '',
          `/pulse/app/initiate?project=${data.id}`
        );
      }
      return null;
    }

    const { error: updErr } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId);
    return updErr ?? null;
  };

  // Save Step 2 onto the existing project row.
  const persistStep2 = async () => {
    const payload = {
      strategic_rationale: clean(ctx.strategic_rationale),
      target_end_user: clean(ctx.target_end_user),
      exit_strategy: clean(ctx.exit_strategy),
      strategic_alignment: clean(ctx.strategic_alignment),
    };
    const { error: updErr } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId);
    return updErr ?? null;
  };

  // Save Step 3. UPDATE each of the five existing objective rows by id;
  // never INSERT (the rows are seeded and uniquely keyed per type). A
  // non_negotiable objective carries no tolerance, so store null for it.
  const persistStep3 = async () => {
    // Belt-and-braces: Step 3's controls are read-only once the baseline is
    // committed (objectivesFrozen), so this is not reached then. The guard
    // makes any stray call a no-op, so classification never changes outside a
    // re-baseline.
    if (objectivesFrozen) return null;
    const results = await Promise.all(
      objectives.map((o) =>
        supabase
          .from('project_objectives')
          .update({
            definition: clean(o.definition),
            classification: o.classification,
            tolerance:
              o.classification === 'flexible' ? clean(o.tolerance) : null,
          })
          .eq('id', o.id)
      )
    );
    return results.find((r) => r.error)?.error ?? null;
  };

  // Save Step 4. Write rank 1..5 onto the existing rows to match the
  // chosen order (top of the list is rank 1).
  const persistStep4 = async () => {
    // Belt-and-braces: the ranking controls are disabled once the baseline is
    // committed (objectivesFrozen). The guard makes a stray call a no-op.
    if (objectivesFrozen) return null;
    const byType = Object.fromEntries(
      objectives.map((o) => [o.objective_type, o])
    );
    const results = await Promise.all(
      rankOrder.map((type, i) =>
        supabase
          .from('project_objectives')
          .update({ rank: i + 1 })
          .eq('id', byType[type].id)
      )
    );
    return results.find((r) => r.error)?.error ?? null;
  };

  // Save Step 4 Scope and Site. Upsert on project_id (insert-if-absent), so a
  // project seeded with a row updates it and one predating the seed inserts.
  // The mix and quantum rows assemble into the mix_quantum JSONB.
  const persistScopeSite = async () => {
    const payload = {
      development_summary: clean(scope.development_summary),
      mix_quantum: buildMixQuantum(scope.mix),
      spec_standard: clean(scope.spec_standard),
      site_area: clean(scope.site_area),
      planning_status: clean(scope.planning_status),
      planning_constraints: clean(scope.planning_constraints),
      physical_constraints: clean(scope.physical_constraints),
    };
    const { error: upErr } = await supabase
      .from('project_scope_site')
      .upsert({ project_id: projectId, ...payload }, { onConflict: 'project_id' });
    return upErr ?? null;
  };

  // Reconcile the Step 5 parties against the database, the same way the lists
  // do: blank rows (no name) are dropped, existing rows updated, new rows
  // inserted, and removed rows deleted. Returns the save error (or null) plus a
  // map from each kept party's client key to its database id, so the caller can
  // resolve the named authority to a real id.
  const persistStakeholders = async () => {
    const keep = stakeholders.filter((it) => clean(it.name) != null);
    const keepIdsInDb = new Set(keep.filter((it) => it.id).map((it) => it.id));
    const prevIds = persistedStakeholderIdsRef.current;
    const toDelete = [...prevIds].filter((id) => !keepIdsInDb.has(id));
    const toUpdate = keep.filter((it) => it.id);
    const toInsert = keep.filter((it) => !it.id);

    const rowOf = (it) => ({
      name: clean(it.name),
      organisation: clean(it.organisation),
      role: it.role,
      contact: clean(it.contact),
    });

    let errored = false;
    let deletedSet = new Set();

    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('project_stakeholders')
        .delete()
        .in('id', toDelete);
      if (delErr) errored = true;
      else deletedSet = new Set(toDelete);
    }

    if (toUpdate.length) {
      const updRes = await Promise.all(
        toUpdate.map((it) =>
          supabase.from('project_stakeholders').update(rowOf(it)).eq('id', it.id)
        )
      );
      if (updRes.some((r) => r.error)) errored = true;
    }

    const newIdByKey = {};
    if (toInsert.length) {
      const insRes = await Promise.all(
        toInsert.map((it) =>
          supabase
            .from('project_stakeholders')
            .insert({ project_id: projectId, ...rowOf(it) })
            .select('id')
            .single()
            .then((res) => ({ it, res }))
        )
      );
      for (const { it, res } of insRes) {
        if (res.error || !res.data) errored = true;
        else newIdByKey[it._key] = res.data.id;
      }
    }

    const nextItems = keep.map((it) =>
      it.id || !newIdByKey[it._key] ? it : { ...it, id: newIdByKey[it._key] }
    );
    setStakeholders(nextItems);

    const nextPersisted = new Set(
      [...prevIds].filter((id) => !deletedSet.has(id))
    );
    for (const k in newIdByKey) nextPersisted.add(newIdByKey[k]);
    persistedStakeholderIdsRef.current = nextPersisted;

    const keyToId = {};
    for (const it of nextItems) if (it.id) keyToId[it._key] = it.id;

    return {
      error: errored ? new Error('stakeholders_save_failed') : null,
      keyToId,
    };
  };

  // Save Step 5: persist the parties first (so a newly added authority has an
  // id), then write the governance fields onto the projects row. The named
  // authority resolves from its party's client key; if that party was blank or
  // removed it stores null. The cadence and the digest recipient are recorded
  // baseline facts and do not touch the live digest.
  const persistOrganisation = async () => {
    const { error: skErr, keyToId } = await persistStakeholders();
    if (skErr) return skErr;
    const authorityId = org.authority_key
      ? keyToId[org.authority_key] ?? null
      : null;
    const { error: updErr } = await supabase
      .from('projects')
      .update({
        reporting_cadence: clean(org.reporting_cadence),
        digest_recipient: clean(org.digest_recipient),
        authority_stakeholder_id: authorityId,
      })
      .eq('id', projectId);
    return updErr ?? null;
  };

  // Reconcile the Step 6 funding milestones against the database, the same way
  // the other lists do: blank rows (no label) are dropped, existing rows
  // updated, new rows inserted, removed rows deleted. Returns the save error
  // or null.
  const persistFundingMilestones = async () => {
    const items = financial.milestones;
    const keep = items.filter((it) => clean(it.label) != null);
    const keepIdsInDb = new Set(keep.filter((it) => it.id).map((it) => it.id));
    const prevIds = persistedFmIdsRef.current;
    const toDelete = [...prevIds].filter((id) => !keepIdsInDb.has(id));
    const toUpdate = keep.filter((it) => it.id);
    const toInsert = keep.filter((it) => !it.id);

    const rowOf = (it) => ({
      label: clean(it.label),
      amount: cleanNumeric(it.amount),
      target_date: clean(it.target_date),
      status: it.status,
      note: clean(it.note),
    });

    let errored = false;
    let deletedSet = new Set();

    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('project_funding_milestones')
        .delete()
        .in('id', toDelete);
      if (delErr) errored = true;
      else deletedSet = new Set(toDelete);
    }

    if (toUpdate.length) {
      const updRes = await Promise.all(
        toUpdate.map((it) =>
          supabase
            .from('project_funding_milestones')
            .update(rowOf(it))
            .eq('id', it.id)
        )
      );
      if (updRes.some((r) => r.error)) errored = true;
    }

    const newIdByKey = {};
    if (toInsert.length) {
      const insRes = await Promise.all(
        toInsert.map((it) =>
          supabase
            .from('project_funding_milestones')
            .insert({ project_id: projectId, ...rowOf(it) })
            .select('id')
            .single()
            .then((res) => ({ it, res }))
        )
      );
      for (const { it, res } of insRes) {
        if (res.error || !res.data) errored = true;
        else newIdByKey[it._key] = res.data.id;
      }
    }

    const nextItems = keep.map((it) =>
      it.id || !newIdByKey[it._key] ? it : { ...it, id: newIdByKey[it._key] }
    );
    setFinancial((prev) => (prev ? { ...prev, milestones: nextItems } : prev));

    const nextPersisted = new Set(
      [...prevIds].filter((id) => !deletedSet.has(id))
    );
    for (const k in newIdByKey) nextPersisted.add(newIdByKey[k]);
    persistedFmIdsRef.current = nextPersisted;

    return errored ? new Error('funding_milestones_save_failed') : null;
  };

  // Save Step 6. The headline figures moved from Step 1 are written to the
  // projects row (they live in `def`); the breakdown, the funding structure and
  // the notes upsert onto project_budget; then the funding milestones reconcile.
  const persistFinancial = async () => {
    const { error: projErr } = await supabase
      .from('projects')
      .update({
        currency: def.currency || 'GBP',
        budget: cleanNumeric(def.budget),
        projected_gdv: cleanNumeric(def.projected_gdv),
        projected_roi: cleanNumeric(def.projected_roi),
        financial_detail_url: clean(def.financial_detail_url),
      })
      .eq('id', projectId);
    if (projErr) return projErr;

    const { error: budgetErr } = await supabase.from('project_budget').upsert(
      {
        project_id: projectId,
        budget_breakdown: buildBreakdown(financial),
        funding_structure_type: clean(financial.funding_structure_type),
        funding_notes: clean(financial.funding_notes),
      },
      { onConflict: 'project_id' }
    );
    if (budgetErr) return budgetErr;

    return await persistFundingMilestones();
  };

  // Save Step 7's stage gate target dates: update target_date on each of the
  // eight seeded rows by id. Only target_date is written, so the gate status,
  // sign-off and re-baseline fields the Gate module owns are never touched.
  const persistGates = async () => {
    const results = await Promise.all(
      gates.map((g) =>
        supabase
          .from('project_stage_gates')
          .update({ target_date: clean(g.target_date) })
          .eq('id', g.id)
      )
    );
    return results.find((r) => r.error)?.error ?? null;
  };

  // Save a Step 5 to 7 list: reconcile the screen against the database so the
  // two match exactly. Blank rows (empty required field) are not real items,
  // so they are never inserted and are dropped from the screen. Rows already
  // in the database are updated, new rows inserted, and database rows no
  // longer on screen deleted. Inserted ids are written back before any error
  // is surfaced, so a retry never duplicates a row. Returns an Error on
  // failure, or null on success.
  const persistList = async (key) => {
    const cfg = LIST_CONFIG[key];
    const items = lists[key];

    const keep = items.filter((it) => !isBlank(cfg, it));
    const keepIdsInDb = new Set(keep.filter((it) => it.id).map((it) => it.id));

    const prevIds = persistedIdsRef.current[key];
    const toDelete = [...prevIds].filter((id) => !keepIdsInDb.has(id));
    const toUpdate = keep.filter((it) => it.id);
    const toInsert = keep.filter((it) => !it.id);

    let errored = false;
    let deletedSet = new Set();

    // 1. Deletes (one statement, idempotent on retry).
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from(cfg.table)
        .delete()
        .in('id', toDelete);
      if (delErr) errored = true;
      else deletedSet = new Set(toDelete);
    }

    // 2. Updates (idempotent on retry).
    if (toUpdate.length) {
      const updRes = await Promise.all(
        toUpdate.map((it) =>
          supabase.from(cfg.table).update(itemToRow(cfg, it)).eq('id', it.id)
        )
      );
      if (updRes.some((r) => r.error)) errored = true;
    }

    // 3. Inserts (per row, so each returned id maps back to its item).
    const newIdByKey = {};
    if (toInsert.length) {
      const insRes = await Promise.all(
        toInsert.map((it) =>
          supabase
            .from(cfg.table)
            .insert({ project_id: projectId, ...itemToRow(cfg, it) })
            .select('id')
            .single()
            .then((res) => ({ it, res }))
        )
      );
      for (const { it, res } of insRes) {
        if (res.error || !res.data) errored = true;
        else newIdByKey[it._key] = res.data.id;
      }
    }

    // Sync the screen to what now exists: keep only non-blank items, with any
    // freshly inserted ids attached.
    const nextItems = keep.map((it) =>
      it.id || !newIdByKey[it._key] ? it : { ...it, id: newIdByKey[it._key] }
    );
    setLists((prev) => (prev ? { ...prev, [key]: nextItems } : prev));

    // Recompute the set of ids known to be in the database.
    const nextPersisted = new Set(
      [...prevIds].filter((id) => !deletedSet.has(id))
    );
    for (const k in newIdByKey) nextPersisted.add(newIdByKey[k]);
    persistedIdsRef.current = {
      ...persistedIdsRef.current,
      [key]: nextPersisted,
    };

    return errored ? new Error('list_save_failed') : null;
  };

  const handleNext = async () => {
    setError(null);

    if (step === 1) {
      if (!nameValid) {
        setError('Please give the project a name to continue.');
        return;
      }
      setBusy(true);
      const err = await persistStep1();
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(2);
      return;
    }

    if (step === 2) {
      setBusy(true);
      const err = await persistStep2();
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(3);
      return;
    }

    // Step 3: persist the objective definitions and the priority ranking
    // together. Both are no-ops once the baseline is committed (frozen).
    if (step === 3) {
      setBusy(true);
      const objErr = await persistStep3();
      const rankErr = objErr ? null : await persistStep4();
      setBusy(false);
      if (objErr || rankErr) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(4);
      return;
    }

    // Step 4 Scope and Site: upsert the project_scope_site record.
    if (step === 4) {
      setBusy(true);
      const err = await persistScopeSite();
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(5);
      return;
    }

    // Step 6 Financial Baseline: the headline figures on the projects row, the
    // budget breakdown and funding on project_budget, and the funding milestones.
    if (step === 6) {
      setBusy(true);
      const err = await persistFinancial();
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(7);
      return;
    }

    // Step 5 Organisation and Governance: the parties, the named authority and
    // the cadence (persistOrganisation), then the workstreams list.
    if (step === 5) {
      setBusy(true);
      const orgErr = await persistOrganisation();
      const wsErr = orgErr ? null : await persistList('workstreams');
      setBusy(false);
      if (orgErr || wsErr) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(6);
      return;
    }

    // Step 7 Programme: the stage gate target dates (persistGates), then the
    // critical milestones list.
    if (step === 7) {
      setBusy(true);
      const gatesErr = await persistGates();
      const msErr = gatesErr ? null : await persistList('milestones');
      setBusy(false);
      if (gatesErr || msErr) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(8);
      return;
    }

    // Step 8 RAID: the risks and the three sibling lists (assumptions,
    // constraints, dependencies). Persist each in turn; stop on the first error.
    if (step === 8) {
      setBusy(true);
      let err = null;
      for (const key of ['risks', 'assumptions', 'constraints', 'dependencies']) {
        err = await persistList(key);
        if (err) break;
      }
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(9);
      return;
    }

    // Step 9 (the brief) is the last step and has no Next; its button is
    // disabled, so there is nothing to handle here.
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  // Progress-dot navigation: only to steps already reached (free-backward,
  // no jumping ahead). Blocked while a save is in flight.
  const goToStep = (n) => {
    if (busy) return;
    if (n <= maxReached) {
      setError(null);
      setStep(n);
    }
  };

  // The over-constraint condition for step 3: every objective marked
  // non-negotiable, so the project has left itself no room to flex. Drives
  // the soft advisory warning only; it never blocks advancing.
  const overConstrained =
    objStatus === 'loaded' &&
    objectives.every((o) => o.classification === 'non_negotiable');

  // Loading / error fallback for Step 4 while the scope and site record is
  // fetched. Mirrors the step header so the panel stays consistent.
  const renderScopeNotReady = () => {
    return (
      <>
        <p className={styles.panelEyebrow}>Step 4 of 9</p>
        <h2 className={styles.panelHeading}>Scope and Site</h2>
        {scopeStatus === 'error' ? (
          <>
            <p className={styles.panelIntro}>
              We could not load this step. Please check your connection and try
              again.
            </p>
            <button
              type="button"
              className={styles.btnNext}
              onClick={loadScopeSite}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className={styles.skeleton} aria-hidden="true">
              <div className={`${styles.skelBar} ${styles.skelShort}`} />
              <div className={styles.skelBar} />
              <div className={styles.skelBar} />
            </div>
            <span className={styles.srOnly} role="status">
              Loading…
            </span>
          </>
        )}
      </>
    );
  };

  // Loading / error fallback for Step 6 while the budget record is fetched.
  const renderFinancialNotReady = () => {
    return (
      <>
        <p className={styles.panelEyebrow}>Step 6 of 9</p>
        <h2 className={styles.panelHeading}>Financial Baseline</h2>
        {financialStatus === 'error' ? (
          <>
            <p className={styles.panelIntro}>
              We could not load this step. Please check your connection and try
              again.
            </p>
            <button
              type="button"
              className={styles.btnNext}
              onClick={loadFinancial}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className={styles.skeleton} aria-hidden="true">
              <div className={`${styles.skelBar} ${styles.skelShort}`} />
              <div className={styles.skelBar} />
              <div className={styles.skelBar} />
            </div>
            <span className={styles.srOnly} role="status">
              Loading…
            </span>
          </>
        )}
      </>
    );
  };

  // Loading / error fallback for the objectives step (3) while the objective
  // rows are fetched. Mirrors the step header so the panel stays consistent.
  const renderObjectivesNotReady = (n) => {
    return (
      <>
        <p className={styles.panelEyebrow}>Step {n} of 9</p>
        <h2 className={styles.panelHeading}>Objectives and Priority</h2>
        {objStatus === 'error' ? (
          <>
            <p className={styles.panelIntro}>
              We could not load the objectives for this project. Please check
              your connection and try again.
            </p>
            <button
              type="button"
              className={styles.btnNext}
              onClick={loadObjectives}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className={styles.skeleton} aria-hidden="true">
              <div className={`${styles.skelBar} ${styles.skelShort}`} />
              <div className={styles.skelBar} />
              <div className={styles.skelBar} />
            </div>
            <span className={styles.srOnly} role="status">
              Loading your objectives…
            </span>
          </>
        )}
      </>
    );
  };

  // Loading / error fallback for Steps 5 to 7. Surfaces an objectives failure
  // too, since the lists load depends on the objectives being loaded first.
  const renderListNotReady = (n, titleOverride) => {
    const title = titleOverride ?? CONFIG_BY_STEP[n].title;
    const failed =
      objStatus === 'error' ||
      listsStatus === 'error' ||
      (n === 5 && stakeholdersStatus === 'error') ||
      (n === 7 && gatesStatus === 'error');
    return (
      <>
        <p className={styles.panelEyebrow}>Step {n} of 9</p>
        <h2 className={styles.panelHeading}>{title}</h2>
        {failed ? (
          <>
            <p className={styles.panelIntro}>
              We could not load this step. Please check your connection and try
              again.
            </p>
            <button
              type="button"
              className={styles.btnNext}
              onClick={retryListData}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className={styles.skeleton} aria-hidden="true">
              <div className={`${styles.skelBar} ${styles.skelShort}`} />
              <div className={styles.skelBar} />
              <div className={styles.skelBar} />
            </div>
            <span className={styles.srOnly} role="status">
              Loading…
            </span>
          </>
        )}
      </>
    );
  };

  const renderStep = () => {
    if (step === 1) {
      return <StepProjectDefinition values={def} onChange={onDefChange} />;
    }
    if (step === 2) {
      return <StepStrategicContext values={ctx} onChange={onCtxChange} />;
    }
    // Step 3 merges the objective definitions and the priority ranking.
    if (step === 3) {
      if (objStatus !== 'loaded') {
        return renderObjectivesNotReady(step);
      }
      return (
        <>
          <StepProjectObjectives
            objectives={objectives}
            onChange={onObjectiveChange}
            frozen={objectivesFrozen}
          />
          <StepConstraintRanking
            order={rankOrder}
            objectives={objectives}
            overConstrained={overConstrained}
            onMove={moveObjective}
            onReorder={onReorder}
            frozen={objectivesFrozen}
          />
        </>
      );
    }
    // Step 4 Scope and Site.
    if (step === 4) {
      if (scopeStatus !== 'loaded') {
        return renderScopeNotReady();
      }
      return (
        <StepScopeSite
          values={scope}
          onChange={onScopeChange}
          mix={scope.mix}
          onMixField={onMixField}
          onMixAdd={onMixAdd}
          onMixRemove={onMixRemove}
          country={def.country}
        />
      );
    }
    // Step 6 Financial Baseline.
    if (step === 6) {
      if (financialStatus !== 'loaded') {
        return renderFinancialNotReady();
      }
      return (
        <StepFinancialBaseline
          def={def}
          onDefChange={onDefChange}
          financial={financial}
          onFinancialChange={onFinancialChange}
          milestones={financial.milestones}
          onFmField={onFmField}
          onFmAdd={onFmAdd}
          onFmRemove={onFmRemove}
        />
      );
    }
    // Step 5 Organisation and Governance: the parties, the named authority and
    // the cadence, then the workstreams list as a continuation section.
    if (step === 5) {
      if (
        objStatus !== 'loaded' ||
        listsStatus !== 'loaded' ||
        stakeholdersStatus !== 'loaded'
      ) {
        return renderListNotReady(5, 'Organisation and Governance');
      }
      return (
        <>
          <StepOrganisation
            parties={stakeholders}
            onPartyField={onPartyField}
            onPartyAdd={onPartyAdd}
            onPartyRemove={onPartyRemove}
            org={org}
            onOrgChange={onOrgChange}
          />
          <StepItemList
            key="workstreams"
            config={LIST_CONFIG.workstreams}
            items={lists.workstreams}
            objectives={objectives}
            onField={(itemKey, field, value) =>
              onListField('workstreams', itemKey, field, value)
            }
            onLink={(itemKey, value) => onListLink('workstreams', itemKey, value)}
            onCriticality={(itemKey, value) =>
              onListCriticality('workstreams', itemKey, value)
            }
            onAdd={() => onListAdd('workstreams')}
            onRemove={(itemKey) => onListRemove('workstreams', itemKey)}
            asSection
            sectionTitle="Workstreams"
            sectionIntro={LIST_CONFIG.workstreams.intro}
          />
        </>
      );
    }

    // Step 7 Programme: the eight stage gate target dates, then the critical
    // milestones list as a continuation section.
    if (step === 7) {
      if (
        objStatus !== 'loaded' ||
        listsStatus !== 'loaded' ||
        gatesStatus !== 'loaded'
      ) {
        return renderListNotReady(7, 'Programme');
      }
      return (
        <>
          <StepProgramme gates={gates} onGateDateChange={onGateDateChange} />
          <StepItemList
            key="milestones"
            config={LIST_CONFIG.milestones}
            items={lists.milestones}
            objectives={objectives}
            onField={(itemKey, field, value) =>
              onListField('milestones', itemKey, field, value)
            }
            onLink={(itemKey, value) => onListLink('milestones', itemKey, value)}
            onCriticality={(itemKey, value) =>
              onListCriticality('milestones', itemKey, value)
            }
            onAdd={() => onListAdd('milestones')}
            onRemove={(itemKey) => onListRemove('milestones', itemKey)}
            asSection
            sectionTitle="Critical milestones"
            sectionIntro={LIST_CONFIG.milestones.intro}
          />
        </>
      );
    }

    // Step 8 RAID: the full picture under one header, four criticality-cascade
    // lists as continuation sections (risks, then the three siblings).
    if (step === 8) {
      if (objStatus !== 'loaded' || listsStatus !== 'loaded') {
        return renderListNotReady(step);
      }
      const raidSection = (key, sectionTitle) => (
        <StepItemList
          key={key}
          config={LIST_CONFIG[key]}
          items={lists[key]}
          objectives={objectives}
          onField={(itemKey, field, value) =>
            onListField(key, itemKey, field, value)
          }
          onLink={(itemKey, value) => onListLink(key, itemKey, value)}
          onCriticality={(itemKey, value) =>
            onListCriticality(key, itemKey, value)
          }
          onAdd={() => onListAdd(key)}
          onRemove={(itemKey) => onListRemove(key, itemKey)}
          asSection
          sectionTitle={sectionTitle}
          sectionIntro={LIST_CONFIG[key].intro}
        />
      );
      return (
        <>
          <p className={styles.panelEyebrow}>Step 8 of 9</p>
          <h2 className={styles.panelHeading}>
            Risks, Assumptions, Constraints and Dependencies
          </h2>
          <p className={styles.panelIntro}>
            The full RAID picture at the outset: the risks you can see, the
            assumptions the baseline rests on, the constraints it must respect,
            and the dependencies it relies on. Link each to the objective it
            bears on. Every field is optional and can be revised before the
            brief is locked.
          </p>
          {raidSection('risks', 'Risks')}
          {raidSection('assumptions', 'Assumptions')}
          {raidSection('constraints', 'Constraints')}
          {raidSection('dependencies', 'Dependencies')}
        </>
      );
    }
    if (step === 9) {
      // The brief assembles from the objectives and the lists, so it waits on
      // the same loads as the list steps.
      if (
        !projectId ||
        objStatus !== 'loaded' ||
        listsStatus !== 'loaded' ||
        scopeStatus !== 'loaded' ||
        stakeholdersStatus !== 'loaded' ||
        financialStatus !== 'loaded' ||
        gatesStatus !== 'loaded'
      ) {
        return renderListNotReady(9, 'Generated Brief');
      }
      return (
        <StepGeneratedBrief
          projectId={projectId}
          supabase={supabase}
          def={def}
          ctx={ctx}
          objectives={objectives}
          rankOrder={rankOrder}
          lists={lists}
          scope={scope}
          org={org}
          stakeholders={stakeholders}
          financial={financial}
          gates={gates}
          currentStage={currentStage}
        />
      );
    }
    // Unreachable: every step (1 to 9) is handled above.
    return null;
  };

  const nextDisabled =
    busy ||
    step === TOTAL_STEPS ||
    (step === 1 && !nameValid) ||
    (step === 3 && objStatus !== 'loaded') ||
    (step === 4 && scopeStatus !== 'loaded') ||
    (step === 5 &&
      (objStatus !== 'loaded' ||
        listsStatus !== 'loaded' ||
        stakeholdersStatus !== 'loaded')) ||
    (step === 6 && financialStatus !== 'loaded') ||
    (step === 7 &&
      (objStatus !== 'loaded' ||
        listsStatus !== 'loaded' ||
        gatesStatus !== 'loaded')) ||
    (step === 8 && (objStatus !== 'loaded' || listsStatus !== 'loaded'));

  const headerTitle = def.name.trim() ? def.name.trim() : 'New project';

  // Stage indicator for the header. Shown for an existing project so the gate
  // advance is visible on the project view; the gate decision date appears
  // once the project has moved past Stage 1.
  const stageName = STAGE_NAMES[currentStage] ?? `Stage ${currentStage}`;
  const gatePassed =
    currentStage >= 2 || initialGate?.gate_status === 'passed';
  const gatePassedDate = formatGateDate(initialGate?.passed_at);

  return (
    <main className={`container ${styles.page}`} id="main-content">
      <div className={styles.header}>
        <Link href="/pulse/app" className={styles.backLink}>
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
          Back to projects
        </Link>
        <h1 className={styles.title}>{headerTitle}</h1>
        <p className={styles.subtitle}>
          Set up the baseline that governs every later stage. Your progress
          saves at each step, so you can leave and resume anytime.
        </p>
        {initialProject && (
          <div className={styles.stageIndicator}>
            <span className={styles.stageChip}>
              Stage {currentStage}: {stageName}
            </span>
            {gatePassed && (
              <span className={styles.stageDecision}>
                Gate 1 to 2 passed{gatePassedDate ? ` ${gatePassedDate}` : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.layout}>
        <nav className={styles.progress} aria-label="Initiation progress">
        <ol className={styles.steps}>
          {STEPS.map((s) => {
            const isCurrent = s.n === step;
            const isReached = s.n <= maxReached;
            const className = [
              styles.step,
              isCurrent ? styles.stepCurrent : '',
              isReached && !isCurrent ? styles.stepReached : '',
            ]
              .filter(Boolean)
              .join(' ');

            const status = isCurrent
              ? ', current step'
              : !isReached
                ? ', not yet available'
                : '';

            return (
              <li key={s.n} className={className}>
                <button
                  type="button"
                  className={styles.dotButton}
                  onClick={() => goToStep(s.n)}
                  disabled={!isReached || busy}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${s.n}: ${s.name}${status}`}
                >
                  {s.n}
                </button>
                <span className={styles.stepName}>{s.short}</span>
              </li>
            );
          })}
        </ol>
        </nav>

        <div className={styles.work}>
          <div className={styles.panel}>
        {/* Keyed by step so the content remounts and eases in on each move. */}
        <div key={step} className={styles.stepAnim}>
          {renderStep()}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnBack}
          onClick={handleBack}
          disabled={step === 1 || busy}
        >
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
          Back
        </button>
        {step === TOTAL_STEPS ? (
          // Terminal step: there is nothing after the brief. The lock and
          // unlock controls in the panel are the primary actions here, so
          // offer a way back to the project list rather than a dead Next.
          <Link href="/pulse/app" className={styles.returnLink}>
            Return to projects
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M5 3l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : (
          <button
            type="button"
            className={styles.btnNext}
            onClick={handleNext}
            disabled={nextDisabled}
          >
            {busy ? 'Saving…' : 'Next'}
            {!busy && (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M5 3l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
        </div>
        </div>
      </div>
    </main>
  );
}
