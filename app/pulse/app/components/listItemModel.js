/**
 * The pure model behind the shared list steps (Step 5 workstreams, the Step 8
 * RAID lists): screen items, database rows, and the capture-time criticality
 * derivation (Note 2). Extracted from the wizard shell so the rules are
 * testable without React or Supabase.
 *
 * Criticality is derived, never chosen (framework principle 3). These lists
 * carry an objective link as the only control; the criticality an item holds
 * is read from that link through the one engine kernel, both for display
 * (captureStamp) and for the write (itemToRow). A manually stored value that
 * contradicts the derivation is recomputed on load (rowToItem), so the value
 * shown and the value locked always agree. The database trigger (migration
 * 034) enforces the same rule at the write path itself.
 */

import {
  buildObjectiveIndex,
  deriveCaptureStamp,
} from '../../../../lib/engine/criticality.js';
import { OBJECTIVE_META, CLASSIFICATION_LABELS } from './objectiveMeta';
import { scopeSuggestions } from './listStepConfig';

// Objective display name lookup, keyed by objective_type (the single source of
// names is objectiveMeta.js).
const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

/**
 * The capture stamp for one item: its derived criticality and the basis it
 * derives from, read live from the wizard's objective state (so a Step 3
 * classification edit recomputes every dependent item wherever it is shown).
 * Returns the kernel's { criticality, basisObjectiveId, basisType,
 * basisClassification, basisName } with basisName resolved for display.
 */
export function captureStamp(linkedObjectiveId, objectives) {
  const { byId } = buildObjectiveIndex(objectives, NAME_BY_TYPE);
  return deriveCaptureStamp(linkedObjectiveId || null, byId);
}

/**
 * The honest basis line under the derived value. Linked: inherited from the
 * objective, with its classification stated. Unlinked: a plain statement that
 * nothing confers criticality, not a blank and not an implied choice.
 */
export function basisLine(stamp) {
  if (!stamp?.basisObjectiveId) {
    return 'No objective linked, so this holds at Standard.';
  }
  const name = stamp.basisName ?? 'the linked objective';
  const classification = CLASSIFICATION_LABELS[stamp.basisClassification];
  return classification
    ? `Inherited from ${name} (${classification.toLowerCase()}).`
    : `Inherited from ${name}.`;
}

/**
 * Optional text cleaned for the database: trimmed, and null when empty, so an
 * optional column is never sent ''.
 */
function clean(v) {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

// Default value for a field on a brand-new (blank) item.
export function fieldDefault(field) {
  if (field.type === 'select') return field.default ?? field.options[0].value;
  return '';
}

// A fresh, unsaved item: no id, unlinked, Standard, fields at their defaults.
export function makeEmptyItem(cfg, makeKey) {
  const item = {
    id: null,
    _key: makeKey(),
    linked_objective_id: '',
    criticality: 'standard',
  };
  for (const f of cfg.fields) item[f.name] = fieldDefault(f);
  return item;
}

/**
 * Map a saved database row onto a screen item. The criticality is recomputed
 * from the objective link, not read from the row (Note 2, task 6): an
 * unlocked draft may hold a manually chosen value from before the derivation
 * was enforced, and recomputing on load means the value shown and the value
 * locked agree, so no stale manual value can reach the reconciliation check
 * at programme lock. Locked snapshots are separate records and stay as they
 * are.
 */
export function rowToItem(cfg, row, objectives, makeKey) {
  const item = {
    id: row.id,
    _key: makeKey(),
    linked_objective_id: row.linked_objective_id ?? '',
    criticality: captureStamp(row.linked_objective_id ?? '', objectives)
      .criticality,
  };
  for (const f of cfg.fields) {
    item[f.name] = row[f.name] ?? (f.type === 'select' ? fieldDefault(f) : '');
  }
  return item;
}

// Build a step's initial list: saved rows if any exist, otherwise the
// suggested starter set (each suggestion merged onto a blank item). The
// starter set scopes to the stages still ahead of the declared entry stage
// (Note 12, scopeSuggestions): a mid-lifecycle adopter is not seeded
// suggestions belonging to stages completed before adoption.
export function buildList(cfg, rows, objectives, makeKey, entryStage) {
  if (rows && rows.length > 0) {
    return rows.map((row) => rowToItem(cfg, row, objectives, makeKey));
  }
  return scopeSuggestions(cfg.suggested, entryStage).map((s) => ({
    ...makeEmptyItem(cfg, makeKey),
    ...s,
  }));
}

// An item is "blank" when its required (identity) field is empty after
// trimming. Blank items are not persisted (the column is NOT NULL) and are
// dropped from the screen on save, so the screen matches the database.
export function isBlank(cfg, item) {
  return clean(item[cfg.requiredField]) == null;
}

/**
 * Map a screen item onto a database row payload (insert or update). Optional
 * text and date fields are cleaned to null when empty; selects (the risk
 * levels) always carry a value. id and _key are intentionally not sent.
 *
 * The criticality sent is the derivation, computed here from the live
 * objective state, never the screen value: the derivation is the only writer
 * of the field. A capture table (cfg.captureBasis) also records the basis
 * beside the value, the deriving objective's type and classification at the
 * moment of the write, so the brief snapshot and the assembled v1 read the
 * same stored fact.
 */
export function itemToRow(cfg, item, objectives) {
  const row = {};
  for (const f of cfg.fields) {
    row[f.name] = f.type === 'select' ? item[f.name] : clean(item[f.name]);
  }
  row.linked_objective_id = item.linked_objective_id || null;
  const stamp = captureStamp(item.linked_objective_id, objectives);
  row.criticality = stamp.criticality;
  if (cfg.captureBasis) {
    row.criticality_basis_type = stamp.basisType;
    row.criticality_basis_classification = stamp.basisClassification;
  }
  return row;
}
