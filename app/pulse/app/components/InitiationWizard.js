'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import StepProjectDefinition from './StepProjectDefinition';
import StepStrategicContext from './StepStrategicContext';
import StepProjectObjectives from './StepProjectObjectives';
import StepConstraintRanking from './StepConstraintRanking';
import StepItemList from './StepItemList';
import StepGeneratedBrief from './StepGeneratedBrief';
import { OBJECTIVE_ORDER } from './objectiveMeta';
import {
  LIST_CONFIG,
  CONFIG_BY_STEP,
  cascadeCriticality,
} from './listStepConfig';
import styles from './InitiationWizard.module.css';

/**
 * InitiationWizard — the eight-step PULSE Project Initiation flow.
 *
 * Steps 1 and 2 (M3.2), 3 and 4 (M3.3), and 5 to 7 (M3.4) are built. Step 8
 * (the generated brief) remains a navigable placeholder until M3.5.
 * Architecture decisions (fixed in the M3.2 spec):
 *
 *   - One route, one wizard. The progress indicator shows all eight steps.
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

// The eight steps. `short` labels the progress dot; `name` titles the
// panel and the dot's accessible label. `body` is the placeholder copy
// for the not-yet-built Step 8; every other step renders its own form.
const STEPS = [
  { n: 1, name: 'Project Definition', short: 'Define' },
  { n: 2, name: 'Strategic Context', short: 'Context' },
  {
    n: 3,
    name: 'Project Objectives',
    short: 'Objectives',
    body: 'Define scope, cost, time, quality, and funding, and classify each by how much it can flex before the project is compromised.',
  },
  {
    n: 4,
    name: 'Constraint Ranking',
    short: 'Ranking',
    body: 'Rank the objectives in priority order, confirm their classification, and surface a warning if the project is over-constrained.',
  },
  // Steps 5 to 7 render their own forms (StepItemList); their intro copy
  // lives in listStepConfig, so no placeholder body is needed here.
  { n: 5, name: 'Critical Milestones', short: 'Milestones' },
  { n: 6, name: 'Workstreams', short: 'Workstreams' },
  { n: 7, name: 'Initial Risk Profile', short: 'Risks' },
  {
    n: 8,
    name: 'Generated Brief',
    short: 'Brief',
    body: 'Assemble, export, and version-lock the baseline Project Brief that governs every later stage.',
  },
];

const TOTAL_STEPS = STEPS.length;

const EMPTY_DEF = {
  name: '',
  project_type: '',
  category: '',
  sub_category: '',
  description: '',
  location: '',
  size: '',
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

const SAVE_ERROR =
  'We could not save this step. Please check your connection and try again, or email hello@flitrr.com.';

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
    size: p.size ?? '',
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

export default function InitiationWizard({ userId, initialProject }) {
  const supabase = createClient();

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

  // Fetch the three list types for the current project. Kept separate from
  // the objectives load so Steps 3 and 4 keep their own ready/error gating,
  // but it runs only after objectives are loaded: the cascade default and the
  // override reconstruction both read objective classifications.
  const loadLists = async (objs) => {
    if (!projectId) return;
    setListsStatus('loading');
    const [m, w, r] = await Promise.all([
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
    ]);
    if (m.error || w.error || r.error) {
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
    });
    persistedIdsRef.current = {
      milestones: new Set((m.data ?? []).map((x) => x.id)),
      workstreams: new Set((w.data ?? []).map((x) => x.id)),
      risks: new Set((r.data ?? []).map((x) => x.id)),
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
    } else {
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
      size: clean(def.size),
      procurement_route: clean(def.procurement_route),
      funding_structure: clean(def.funding_structure),
      start_date: clean(def.start_date),
      target_completion_date: clean(def.target_completion_date),
      // Optional headline financials (M3.5 Phase A). Numerics parsed to a
      // number or null; the appraisal link is cleaned like any other text.
      // currency is a NOT NULL enum, so fall back to GBP if somehow unset.
      currency: def.currency || 'GBP',
      budget: cleanNumeric(def.budget),
      projected_gdv: cleanNumeric(def.projected_gdv),
      projected_roi: cleanNumeric(def.projected_roi),
      financial_detail_url: clean(def.financial_detail_url),
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

    if (step === 3) {
      setBusy(true);
      const err = await persistStep3();
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(4);
      return;
    }

    if (step === 4) {
      setBusy(true);
      const err = await persistStep4();
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(5);
      return;
    }

    if (step >= 5 && step <= 7) {
      const cfg = CONFIG_BY_STEP[step];
      setBusy(true);
      const err = await persistList(cfg.key);
      setBusy(false);
      if (err) {
        setError(SAVE_ERROR);
        return;
      }
      advanceTo(step + 1);
      return;
    }

    // Step 8 (the brief) is the last step and has no Next; its button is
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

  // The over-constraint condition for Step 4: every objective marked
  // non-negotiable, so the project has left itself no room to flex. Drives
  // the soft advisory warning only; it never blocks advancing.
  const overConstrained =
    objStatus === 'loaded' &&
    objectives.every((o) => o.classification === 'non_negotiable');

  // Loading / error fallback for Steps 3 and 4 while the objective rows
  // are fetched. Mirrors the step header so the panel stays consistent.
  const renderObjectivesNotReady = (n) => {
    const title = n === 3 ? 'Project Objectives' : 'Constraint Ranking';
    return (
      <>
        <p className={styles.panelEyebrow}>Step {n} of 8</p>
        <h2 className={styles.panelHeading}>{title}</h2>
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
          <p className={styles.panelIntro}>Loading your objectives…</p>
        )}
      </>
    );
  };

  // Loading / error fallback for Steps 5 to 7. Surfaces an objectives failure
  // too, since the lists load depends on the objectives being loaded first.
  const renderListNotReady = (n, titleOverride) => {
    const title = titleOverride ?? CONFIG_BY_STEP[n].title;
    const failed = objStatus === 'error' || listsStatus === 'error';
    return (
      <>
        <p className={styles.panelEyebrow}>Step {n} of 8</p>
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
          <p className={styles.panelIntro}>Loading…</p>
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
    if (step === 3 || step === 4) {
      if (objStatus !== 'loaded') {
        return renderObjectivesNotReady(step);
      }
      if (step === 3) {
        return (
          <StepProjectObjectives
            objectives={objectives}
            onChange={onObjectiveChange}
          />
        );
      }
      return (
        <StepConstraintRanking
          order={rankOrder}
          objectives={objectives}
          overConstrained={overConstrained}
          onMove={moveObjective}
          onReorder={onReorder}
        />
      );
    }
    if (step >= 5 && step <= 7) {
      if (objStatus !== 'loaded' || listsStatus !== 'loaded') {
        return renderListNotReady(step);
      }
      const cfg = CONFIG_BY_STEP[step];
      // key per step so StepItemList remounts (and resets its focus
      // bookkeeping) when switching between Steps 5, 6 and 7.
      return (
        <StepItemList
          key={cfg.key}
          config={cfg}
          items={lists[cfg.key]}
          objectives={objectives}
          onField={(itemKey, field, value) =>
            onListField(cfg.key, itemKey, field, value)
          }
          onLink={(itemKey, value) => onListLink(cfg.key, itemKey, value)}
          onCriticality={(itemKey, value) =>
            onListCriticality(cfg.key, itemKey, value)
          }
          onAdd={() => onListAdd(cfg.key)}
          onRemove={(itemKey) => onListRemove(cfg.key, itemKey)}
        />
      );
    }
    if (step === 8) {
      // The brief assembles from the objectives and the three lists, so it
      // waits on the same loads as Steps 5 to 7.
      if (!projectId || objStatus !== 'loaded' || listsStatus !== 'loaded') {
        return renderListNotReady(8, 'Generated Brief');
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
        />
      );
    }
    // Unreachable: every step (1 to 8) is handled above.
    return null;
  };

  const nextDisabled =
    busy ||
    step === TOTAL_STEPS ||
    (step === 1 && !nameValid) ||
    ((step === 3 || step === 4) && objStatus !== 'loaded') ||
    (step >= 5 &&
      step <= 7 &&
      (objStatus !== 'loaded' || listsStatus !== 'loaded'));

  const headerTitle = def.name.trim() ? def.name.trim() : 'New project';

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
      </div>

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

      <div className={styles.panel}>
        {renderStep()}
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
    </main>
  );
}
