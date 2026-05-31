'use client';

import { useState } from 'react';
import {
  OBJECTIVE_META,
  CLASSIFICATION_LABELS,
} from './objectiveMeta';
import styles from './InitiationWizard.module.css';

/**
 * Step 4 — Constraint Ranking. The developer orders the five objectives by
 * priority, highest at the top, so that when two objectives pull against
 * each other the project knows which one holds (framework Section 7).
 *
 * The shell owns the canonical order of priorities (`order`, an array of
 * objective_type strings) and the objectives' state (`objectives`, for the
 * classification badges). Reordering reports up through `onReorder` (a new
 * full order) and `onMove` (one row, one step). The only local state here
 * is ephemeral drag tracking, which never leaves the component.
 *
 * Classification is read-only on this step: the badges reflect what was set
 * in Step 3, and changing one means going Back. The over-constraint
 * warning is soft, advisory only, and never blocks advancing; the hard
 * enforcement lives later at the stage gate.
 */

// Display name lookup, keyed by objective_type.
const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

export default function StepConstraintRanking({
  order,
  objectives,
  overConstrained,
  onMove,
  onReorder,
}) {
  // Ephemeral drag state. `dragType` is the row being dragged; `overType`
  // is the row currently hovered as a drop target (for the drop-line cue).
  const [dragType, setDragType] = useState(null);
  const [overType, setOverType] = useState(null);

  const classificationByType = Object.fromEntries(
    (objectives ?? []).map((o) => [o.objective_type, o.classification])
  );

  const resetDrag = () => {
    setDragType(null);
    setOverType(null);
  };

  // Move the dragged row to the dropped-on row's position, preserving the
  // relative order of everything else.
  const handleDrop = (targetType) => {
    if (!dragType || dragType === targetType) {
      resetDrag();
      return;
    }
    const next = [...order];
    const from = next.indexOf(dragType);
    const to = next.indexOf(targetType);
    if (from === -1 || to === -1) {
      resetDrag();
      return;
    }
    next.splice(from, 1);
    next.splice(to, 0, dragType);
    onReorder(next);
    resetDrag();
  };

  return (
    <>
      <p className={styles.panelEyebrow}>Step 4 of 8</p>
      <h2 className={styles.panelHeading}>Constraint Ranking</h2>
      <p className={styles.panelIntro}>
        Rank your objectives by priority, highest at the top. When two
        objectives pull against each other, this order decides which one
        holds.
      </p>

      <p className={styles.hint}>
        Drag a row to reorder it, or use the up and down controls on each
        row.
      </p>

      {/* Persistent live region so the warning is announced when it
          appears or clears, without stealing focus. */}
      <div aria-live="polite">
        {overConstrained && (
          <div className={styles.warning} role="status">
            <svg
              className={styles.warningIcon}
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className={styles.warningText}>
              Every objective is marked non-negotiable. A project with no room
              to flex has nothing to give when reality bites, and is usually
              undeliverable. Consider which objective could be flexible.
            </p>
          </div>
        )}
      </div>

      <ol className={styles.rankList}>
        {order.map((type, index) => {
          const classification =
            classificationByType[type] ?? 'flexible';
          const isNonNegotiable = classification === 'non_negotiable';
          const rowClass = [
            styles.rankRow,
            dragType === type ? styles.rankRowDragging : '',
            overType === type && dragType && dragType !== type
              ? styles.rankRowDragOver
              : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={type}
              className={rowClass}
              draggable
              onDragStart={(e) => {
                setDragType(type);
                // Required for the drag to initiate in Firefox; also marks
                // this as a move rather than a copy.
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', type);
              }}
              onDragEnd={resetDrag}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overType !== type) setOverType(type);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(type);
              }}
            >
              <span className={styles.rankHandle} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M5 4h.01M5 8h.01M5 12h.01M11 4h.01M11 8h.01M11 12h.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>

              <span className={styles.rankNum} aria-hidden="true">
                {index + 1}
              </span>

              <span className={styles.rankMain}>
                <span className={styles.rankName}>{NAME_BY_TYPE[type]}</span>
                <span
                  className={`${styles.rankBadge} ${
                    isNonNegotiable
                      ? styles.rankBadgeNN
                      : styles.rankBadgeFlex
                  }`}
                >
                  {CLASSIFICATION_LABELS[classification]}
                </span>
              </span>

              <span className={styles.rankControls}>
                <button
                  type="button"
                  className={styles.moveBtn}
                  onClick={() => onMove(type, 'up')}
                  disabled={index === 0}
                  aria-label={`Move ${NAME_BY_TYPE[type]} up`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 12V4M4 8l4-4 4 4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.moveBtn}
                  onClick={() => onMove(type, 'down')}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${NAME_BY_TYPE[type]} down`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 4v8M4 8l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
