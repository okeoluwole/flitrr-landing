'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import { CLASSIFICATION_LABELS } from '../components/objectiveMeta';
import { cascadeCriticality } from '../components/listStepConfig';
import { STATUS_OPTIONS, isCritical, isDone, sortActions } from './actionModel';
import { deriveRiskItems, buildTrackedActionFromRisk } from './actionFeed';
import styles from './ActionLog.module.css';

/**
 * ActionLog (M7.1 + M7.2) - the central attention home. The
 * needs-your-response band at the top holds risk-derived items computed live
 * from the register rows (actionFeed.js); below it, the tracked list: the
 * project's actions critical-first, with an inline add flow, one-tap status,
 * a one-tap criticality toggle, editing, and delete behind a confirm.
 *
 * The band's items are suggestions awaiting a response, never rows: Track
 * this promotes one into a real tracked action in the same interaction (the
 * dedupe then suppresses the item), and Review in register navigates to the
 * risk, because risk status changes happen there, not here. The band
 * recomputes from local state, so promoting, deleting, or completing a
 * tracked action moves the item out of or back into the band immediately.
 *
 * Criticality cascades from the linked objective as the DEFAULT at creation
 * only (cascadeCriticality, the wizard's helper). After that it never changes
 * silently: re-linking an action does not re-flip it; only the developer's
 * toggle does. Predictable beats clever.
 *
 * Writes are optimistic: the change shows immediately and reverts on a
 * failure. Adds, promotions, and deletes wait for the database (an insert
 * needs its row back; a delete is destructive), with the controls disabled
 * in flight.
 *
 * Out of scope here (M7.3): the notification layer. Everything surfaced is
 * deterministic.
 */

const DESCRIPTION_PLACEHOLDER = 'Describe the action.';
const NOTE_PLACEHOLDER = 'Add a one-line note.';
const NO_OBJECTIVE = 'No objective';

const ADD_ERROR =
  'We could not log that action. Please check your connection and try again.';
const SAVE_ERROR =
  'We could not save that change. Please check your connection and try again.';
const DELETE_ERROR =
  'We could not delete that action. Please check your connection and try again.';
const TRACK_ERROR =
  'We could not track that risk. Please check your connection and try again.';

const CRITICALITY_LABEL = { critical: 'Critical', standard: 'Standard' };

const ACTION_COLUMNS =
  'id, description, linked_objective_id, criticality, status, note, source, source_id, created_at';

function formatLogged(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// A plain-language segmented control. One option active, single select.
function Segmented({ options, value, onSelect, ariaLabel }) {
  return (
    <div className={styles.seg} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.segBtn} ${value === o.value ? styles.segBtnActive : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onSelect(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// The objective link select, shared by the add flow and the edit form. Each
// option carries the objective's classification so the developer can see,
// at the moment of linking, what the cascade will make of it.
function ObjectiveSelect({ id, value, onChange, objectives, ariaLabel }) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <option value="">{NO_OBJECTIVE}</option>
      {objectives.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name} ({CLASSIFICATION_LABELS[o.classification] ?? o.classification})
        </option>
      ))}
    </select>
  );
}

export default function ActionLog({
  projectId,
  projectName,
  workspaceHref,
  registerHref,
  initialActions,
  objectives,
  risks,
}) {
  const supabase = createClient();
  const [actions, setActions] = useState(initialActions);

  // Promotion in flight (one at a time; the band is a response surface, not
  // a bulk tool).
  const [promotingId, setPromotingId] = useState(null);

  // The inline add flow.
  const [draftDescription, setDraftDescription] = useState('');
  const [draftObjectiveId, setDraftObjectiveId] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [adding, setAdding] = useState(false);

  // Per-card edit mode (one card at a time) and the delete confirm step.
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState(null);

  const open = sortActions(actions.filter((a) => !isDone(a)));
  const done = sortActions(actions.filter(isDone));

  // The attention stat: critical actions still open. Done criticals are
  // completed work, not open attention.
  const criticalOpenCount = actions.filter(
    (a) => !isDone(a) && isCritical(a)
  ).length;

  // The needs-your-response items, recomputed from the live register rows
  // and the current actions every render, so promotion (and deleting or
  // completing a tracked action) moves an item out of or back into the band
  // without a reload. Risk status changes happen in the register, so those
  // arrive on the next visit.
  const needsResponse = deriveRiskItems(risks, actions);

  // What the cascade will default a new action to, shown in the add flow at
  // the moment of linking. The default at creation only; never re-applied.
  const draftCriticality = cascadeCriticality(
    draftObjectiveId || null,
    objectives
  );

  const addAction = async () => {
    const description = draftDescription.trim();
    if (!description || adding) return;
    setAdding(true);
    setError(null);

    const note = draftNote.trim();
    const { data, error: insErr } = await supabase
      .from('project_actions')
      .insert({
        project_id: projectId,
        description,
        linked_objective_id: draftObjectiveId || null,
        criticality: draftCriticality,
        note: note === '' ? null : note,
      })
      .select(ACTION_COLUMNS)
      .single();

    if (insErr || !data) {
      setError(ADD_ERROR);
    } else {
      setActions((as) => [data, ...as]);
      setDraftDescription('');
      setDraftObjectiveId('');
      setDraftNote('');
    }
    setAdding(false);
  };

  // Track this (M7.2): promote a pushed item into a real tracked action in
  // one interaction, pre-filled from the risk (actionFeed's deterministic
  // template) and editable after. No confirmation dialog. The insert waits
  // for its row back; as it lands, the dedupe suppresses the pushed item.
  const trackRisk = async (risk) => {
    if (promotingId) return;
    setPromotingId(risk.id);
    setError(null);

    const { data, error: insErr } = await supabase
      .from('project_actions')
      .insert(buildTrackedActionFromRisk(risk, projectId))
      .select(ACTION_COLUMNS)
      .single();

    if (insErr || !data) {
      setError(TRACK_ERROR);
    } else {
      setActions((as) => [data, ...as]);
    }
    setPromotingId(null);
  };

  // Optimistic write: apply locally, persist, revert on failure. Status,
  // the criticality toggle, and edit saves all route through here.
  const applyUpdate = async (id, patch) => {
    const prev = actions.find((a) => a.id === id);
    if (!prev) return;
    setActions((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setError(null);

    const { error: updErr } = await supabase
      .from('project_actions')
      .update(patch)
      .eq('id', id);
    if (updErr) {
      setActions((as) => as.map((a) => (a.id === id ? prev : a)));
      setError(SAVE_ERROR);
    }
  };

  const setStatus = (id, value) => applyUpdate(id, { status: value });

  // The one-tap criticality toggle: the only way criticality changes after
  // creation. The cascade never re-fires.
  const toggleCriticality = (a) =>
    applyUpdate(a.id, {
      criticality: isCritical(a) ? 'standard' : 'critical',
    });

  const startEdit = (a) => {
    setConfirmingId(null);
    setEditingId(a.id);
    setEditDraft({
      description: a.description,
      linked_objective_id: a.linked_objective_id ?? '',
      note: a.note ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  // Saves description, objective link, and note. Deliberately never
  // criticality: re-linking must not re-flip it.
  const saveEdit = (id) => {
    const description = (editDraft?.description ?? '').trim();
    if (!description) return;
    const note = (editDraft?.note ?? '').trim();
    const patch = {
      description,
      linked_objective_id: editDraft.linked_objective_id || null,
      note: note === '' ? null : note,
    };
    setEditingId(null);
    setEditDraft(null);
    applyUpdate(id, patch);
  };

  const requestDelete = (id) => {
    setEditingId(null);
    setEditDraft(null);
    setConfirmingId(id);
  };

  const confirmDelete = async (id) => {
    const prev = actions;
    setActions((as) => as.filter((a) => a.id !== id));
    setConfirmingId(null);
    setError(null);

    const { error: delErr } = await supabase
      .from('project_actions')
      .delete()
      .eq('id', id);
    if (delErr) {
      setActions(prev);
      setError(DELETE_ERROR);
    }
  };

  const objectiveName = (id) =>
    id ? objectives.find((o) => o.id === id)?.name ?? null : null;

  // One pushed item in the needs-your-response band: the risk name, the
  // objective it threatens, why it surfaced as plain chips, and the two
  // responses. Unmistakably a suggestion, never mixed with tracked actions;
  // the register keeps its own status controls.
  const renderPushItem = ({ risk, reasons }) => {
    const linkedName = objectiveName(risk.linked_objective_id);
    const promoting = promotingId === risk.id;

    return (
      <article key={risk.id} className={styles.pushItem}>
        <div className={styles.pushTags}>
          {reasons.critical && (
            <span className={`${styles.chip} ${styles.chipCritical}`}>
              Critical
            </span>
          )}
          {reasons.serious && (
            <span className={`${styles.chip} ${styles.chipSerious}`}>
              Serious
            </span>
          )}
          <span className={styles.objective}>
            {linkedName ? `vs ${linkedName}` : 'Unlinked'}
          </span>
        </div>
        <p className={styles.pushName}>{risk.description}</p>
        <div className={styles.pushActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => trackRisk(risk)}
            disabled={promotingId !== null}
            aria-label={`Track this: ${risk.description}`}
          >
            {promoting ? 'Tracking' : 'Track this'}
          </button>
          <Link
            href={`${registerHref}#risk-${risk.id}`}
            className={styles.ghostBtn}
            aria-label={`Review ${risk.description} in the register`}
          >
            Review in register
          </Link>
        </div>
      </article>
    );
  };

  const renderCard = (a) => {
    const critical = isCritical(a);
    const linkedName = objectiveName(a.linked_objective_id);
    const logged = formatLogged(a.created_at);
    const editing = editingId === a.id;
    const confirming = confirmingId === a.id;

    return (
      <article
        key={a.id}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <button
              type="button"
              className={`${styles.crit} ${critical ? styles.critCritical : styles.critStandard}`}
              aria-pressed={critical}
              aria-label={`Criticality for ${a.description}: ${CRITICALITY_LABEL[a.criticality] ?? 'Standard'}. Tap to change.`}
              title="Tap to change criticality"
              onClick={() => toggleCriticality(a)}
            >
              {CRITICALITY_LABEL[a.criticality] ?? 'Standard'}
            </button>
            {linkedName && (
              <span className={styles.objective}>for {linkedName}</span>
            )}
            {a.source === 'risk' && (
              <Link
                href={
                  a.source_id
                    ? `${registerHref}#risk-${a.source_id}`
                    : registerHref
                }
                className={styles.fromRisk}
              >
                From risk
              </Link>
            )}
          </div>
        </div>

        {editing ? (
          <div className={styles.editForm}>
            <input
              type="text"
              className={styles.input}
              value={editDraft?.description ?? ''}
              onChange={(e) =>
                setEditDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder={DESCRIPTION_PLACEHOLDER}
              aria-label={`Description for ${a.description}`}
              autoComplete="off"
              maxLength={240}
            />
            <div className={styles.editMeta}>
              <ObjectiveSelect
                value={editDraft?.linked_objective_id ?? ''}
                onChange={(v) =>
                  setEditDraft((d) => ({ ...d, linked_objective_id: v }))
                }
                objectives={objectives}
                ariaLabel={`Objective served by ${a.description}`}
              />
              <input
                type="text"
                className={`${styles.input} ${styles.noteInput}`}
                value={editDraft?.note ?? ''}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, note: e.target.value }))
                }
                placeholder={NOTE_PLACEHOLDER}
                aria-label={`Note for ${a.description}`}
                autoComplete="off"
                maxLength={200}
              />
            </div>
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => saveEdit(a.id)}
                disabled={(editDraft?.description ?? '').trim() === ''}
              >
                Save
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.description}>{a.description}</p>
            {a.note && <p className={styles.noteText}>{a.note}</p>}
          </>
        )}

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Status</span>
            <Segmented
              options={STATUS_OPTIONS}
              value={a.status}
              onSelect={(v) => setStatus(a.id, v)}
              ariaLabel={`Status for ${a.description}`}
            />
          </div>
        </div>

        <div className={styles.cardFoot}>
          <span className={styles.logged}>{logged ? `Logged ${logged}` : ''}</span>
          {confirming ? (
            <div className={styles.confirm}>
              <span className={styles.confirmText}>Delete this action?</span>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => confirmDelete(a.id)}
              >
                Delete
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setConfirmingId(null)}
              >
                Keep
              </button>
            </div>
          ) : (
            !editing && (
              <div className={styles.footActions}>
                <button
                  type="button"
                  className={styles.footBtn}
                  onClick={() => startEdit(a)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${styles.footBtn} ${styles.footBtnDanger}`}
                  onClick={() => requestDelete(a.id)}
                >
                  Delete
                </button>
              </div>
            )
          )}
        </div>
      </article>
    );
  };

  return (
    <main className={`container ${styles.page}`} id="main-content">
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
        Back to the project
      </Link>
      <p className={styles.eyebrow}>Action Log module</p>
      <h1 className={styles.title}>Action Log</h1>
      <p className={styles.projectName}>{projectName}</p>

      {/* The needs-your-response band (M7.2): pushed items derived live
          from the register. When nothing qualifies it collapses to one calm
          line. Quiet is a feature. */}
      {needsResponse.length > 0 ? (
        <section className={styles.band} aria-labelledby="needs-response">
          <h2 id="needs-response" className={styles.bandHeading}>
            Needs your response
          </h2>
          <div className={styles.bandList}>
            {needsResponse.map(renderPushItem)}
          </div>
        </section>
      ) : (
        <p className={styles.bandQuiet}>
          Nothing needs your response right now.
        </p>
      )}

      <div className={styles.summary}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{open.length}</span>
          <span className={styles.statLabel}>Open</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.statCritical}`}>
            {criticalOpenCount}
          </span>
          <span className={styles.statLabel}>Critical</span>
        </div>
        {done.length > 0 && (
          <button
            type="button"
            className={styles.doneToggle}
            aria-pressed={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone
              ? `Hide done (${done.length})`
              : `Show done (${done.length})`}
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {/* The inline add flow: a quick log entry, not a long form. */}
      <div className={styles.addPanel}>
        <input
          type="text"
          className={styles.input}
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addAction();
            }
          }}
          placeholder={DESCRIPTION_PLACEHOLDER}
          aria-label="Action description"
          autoComplete="off"
          maxLength={240}
        />
        <div className={styles.addMeta}>
          <ObjectiveSelect
            value={draftObjectiveId}
            onChange={setDraftObjectiveId}
            objectives={objectives}
            ariaLabel="Objective the action serves"
          />
          <input
            type="text"
            className={`${styles.input} ${styles.noteInput}`}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAction();
              }
            }}
            placeholder={NOTE_PLACEHOLDER}
            aria-label="One-line note"
            autoComplete="off"
            maxLength={200}
          />
          {draftCriticality === 'critical' && (
            <span className={`${styles.addHint} riseInSm`}>
              Logs as critical
            </span>
          )}
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.addBtn}`}
            onClick={addAction}
            disabled={adding || draftDescription.trim() === ''}
          >
            {adding ? 'Logging' : 'Log action'}
          </button>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No actions logged yet. Log the first critical action you are
            working on.
          </p>
        </div>
      ) : open.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Every action is done. Use Show done to review them.
          </p>
        </div>
      ) : (
        <div className={styles.list}>{open.map(renderCard)}</div>
      )}

      {showDone && done.length > 0 && (
        <section className={styles.doneSection}>
          <h2 className={styles.doneHeading}>Done</h2>
          <div className={styles.list}>{done.map(renderCard)}</div>
        </section>
      )}
    </main>
  );
}
