'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import StepProjectDefinition from './StepProjectDefinition';
import StepStrategicContext from './StepStrategicContext';
import StepPlaceholder from './StepPlaceholder';
import styles from './InitiationWizard.module.css';

/**
 * InitiationWizard — the eight-step PULSE Project Initiation flow.
 *
 * M3.2 implements the shell plus Steps 1 and 2 fully. Steps 3 to 8 are
 * navigable placeholders. Architecture decisions (fixed in the M3.2 spec):
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
// for steps 3 to 8 (Steps 1 and 2 render their own dedicated forms).
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
  {
    n: 5,
    name: 'Critical Milestones',
    short: 'Milestones',
    body: 'Identify the milestones that matter, each carrying the criticality of the objective it serves.',
  },
  {
    n: 6,
    name: 'Workstreams',
    short: 'Workstreams',
    body: 'Define the workstreams and assign leads, each weighted by the criticality it serves.',
  },
  {
    n: 7,
    name: 'Initial Risk Profile',
    short: 'Risks',
    body: 'Seed the starter risks, each tagged to the objective it threatens and monitored in proportion to that objective.',
  },
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

export default function InitiationWizard({ userId, initialProject }) {
  const supabase = createClient();

  const [projectId, setProjectId] = useState(initialProject?.id ?? null);
  const [step, setStep] = useState(1);
  // Furthest step reached. A resumed draft has, by definition, completed
  // Step 1 (the project exists), so Step 2 is reachable. We can't know if
  // an earlier session went further into the placeholder steps, and it
  // does not matter: those carry no data. The user re-walks forward.
  const [maxReached, setMaxReached] = useState(initialProject ? 2 : 1);
  const [def, setDef] = useState(() => defFrom(initialProject));
  const [ctx, setCtx] = useState(() => ctxFrom(initialProject));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const nameValid = def.name.trim().length > 0;

  const onDefChange = (field, value) => {
    setDef((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const onCtxChange = (field, value) => {
    setCtx((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
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

    // Steps 3 to 7: placeholders, nothing to persist. Just advance.
    if (step < TOTAL_STEPS) {
      advanceTo(step + 1);
    }
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

  const renderStep = () => {
    if (step === 1) {
      return <StepProjectDefinition values={def} onChange={onDefChange} />;
    }
    if (step === 2) {
      return <StepStrategicContext values={ctx} onChange={onCtxChange} />;
    }
    const meta = STEPS[step - 1];
    return <StepPlaceholder name={meta.name} body={meta.body} />;
  };

  const nextDisabled =
    busy || step === TOTAL_STEPS || (step === 1 && !nameValid);

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
      </div>
    </main>
  );
}
