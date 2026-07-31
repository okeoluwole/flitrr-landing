'use client';

import { useState } from 'react';
import { OBJECTIVE_META, CLASSIFICATION_LABELS } from './objectiveMeta';
import { captureStamp } from './listItemModel';
import styles from './InitiationWizard.module.css';

/**
 * RaidSuggestions, the PULSE Suggests band above each Step 8 RAID list (Note 7).
 *
 * WHAT REPLACED WHAT. Step 8 used to pre-fill its risk list with three generic
 * rows: planning permission delayed, construction costs exceed budget, funding
 * delayed. They arrived as editable rows, so a suggestion was indistinguishable
 * from something the developer had written, and they were the same three on
 * every project because they were a flat array conditioned on nothing. These
 * cards are the replacement: each one states the recorded input that selected
 * it, and nothing is written until the developer acts.
 *
 * IT WEARS NO CRITICALITY CHIP, which is B3's rule and it stands here. Criticality
 * derives from the objective an item bears on, and a suggestion bears on none
 * yet: the developer has not agreed to take it on. What the card carries instead
 * is a PROPOSAL, shown in its own visual register and marked as proposed
 * throughout, so it can never be mistaken for the read-only derived badge a
 * captured item wears further down the same step.
 *
 * ADD confirms first. The proposed objective is pre-selected and the developer
 * confirms it, changes it, or clears it; only then does the candidate become an
 * item in the list, exactly like a hand-typed one. Nothing about criticality is
 * chosen here or sent from here: the database trigger derives it from whatever
 * link is confirmed.
 *
 * DISMISS is recorded, and stays gone. It writes a state row for this project
 * and candidate (migration 036), so a suggestion the developer has declined does
 * not come back on the next load. B3's fuller triage, which names who decided
 * and why, lives on the monitoring modules and is still not built here.
 *
 * THE HIDDEN LINE says how many suggestions the band is holding back because
 * they have already been added or dismissed. Without it a developer who
 * dismisses everything sees an empty band and no reason for it, which reads as a
 * fault rather than as their own decisions being respected. One plain line, no
 * control on it: restoring a dismissed suggestion is Note 15's to design.
 *
 * Presentational and controlled: it owns no candidate state beyond which card is
 * open and what objective that card is proposing. The wizard shell holds the
 * lists, the dismissals and the persistence.
 */

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The criticality vocabulary read for display only. The DECISION is never made
// here: it comes from captureStamp, which is Session D's derivation.
const LEVEL_LABELS = { critical: 'Critical', standard: 'Standard' };

/**
 * The line under the objective selector in an open card, stated as a proposal
 * rather than as a classification. "Would be" is doing the work: it is the
 * criticality the item WOULD take if this link is confirmed, not a criticality
 * anything currently holds.
 *
 * `stamp` is Session D's own derivation for the currently selected link, so the
 * rule is called, never restated here.
 */
function proposalLine(stamp) {
  const level = LEVEL_LABELS[stamp.criticality] ?? 'Standard';
  if (!stamp.basisObjectiveId) {
    return `No objective linked, so this would be captured at ${level}.`;
  }
  const name = stamp.basisName ?? 'the linked objective';
  const classification = CLASSIFICATION_LABELS[stamp.basisClassification];
  return classification
    ? `Linked to ${name} (${classification.toLowerCase()}), this would be captured at ${level}.`
    : `Linked to ${name}, this would be captured at ${level}.`;
}

/**
 * The hidden line. One sentence, stating only what it knows: a count of the
 * candidates this band is holding back.
 *
 * "Added or dismissed" is honest about both reasons the engine suppresses on. A
 * candidate answered on this project was added or dismissed outright; one
 * suppressed because its text already sits in the list is one the developer has
 * added, whether from a card or by typing it. Neither reason is a suggestion
 * being withheld for a reason of the product's own.
 */
function hiddenLine(count) {
  return count === 1
    ? '1 suggestion is hidden because you have already added or dismissed it.'
    : `${count} suggestions are hidden because you have already added or dismissed them.`;
}

export default function RaidSuggestions({
  candidates,
  objectives,
  // The list's own plural noun, taken from its config: "dependencies", not
  // "dependencys". The config carries nounPlural precisely where the s is wrong.
  nounPlural,
  addLabel,
  linkLabel,
  // How many candidates of this type the engine suppressed, so the band can say
  // why it is shorter than it was rather than just being shorter.
  hiddenCount = 0,
  onAdd,
  onDismiss,
}) {
  // The open card, and the objective it is currently proposing. Held here
  // because it is a property of the open confirmation, not of the candidate.
  const [openKey, setOpenKey] = useState(null);
  const [chosenObjectiveId, setChosenObjectiveId] = useState('');

  const offered = candidates ?? [];
  const hidden = Number(hiddenCount) || 0;

  // Nothing offered and nothing held back is nothing to say. Nothing offered
  // but something held back still renders, because that is exactly the state a
  // developer who dismissed everything would otherwise read as a fault.
  if (offered.length === 0 && hidden === 0) return null;

  const startAdd = (candidate) => {
    setOpenKey(candidate.key);
    // The proposal is pre-selected, never pre-committed. No proposal resolved
    // means the selector opens unlinked, which is the honest starting point.
    setChosenObjectiveId(candidate.proposal?.objectiveId ?? '');
  };

  const cancel = () => {
    setOpenKey(null);
    setChosenObjectiveId('');
  };

  const confirmAdd = (candidate) => {
    onAdd(candidate, chosenObjectiveId);
    cancel();
  };

  // The criticality the currently selected link would give, for the line inside
  // the open card. Session D's derivation, read live from the wizard's objective
  // state, so changing the objective updates what the line says before anything
  // is saved, and a Step 3 reclassification is reflected without a reload.
  const confirmedStamp = captureStamp(chosenObjectiveId, objectives);

  return (
    <section className={styles.suggestBand} aria-label={`Suggested ${nounPlural}`}>
      <div className={styles.suggestHead}>
        <span className={styles.suggestEyebrow}>PULSE Suggests</span>
        {offered.length > 0 ? (
          <p className={styles.suggestHint}>
            Drawn from what you have recorded so far. Each one says what selected
            it. Nothing is added until you add it.
          </p>
        ) : null}
        {hidden > 0 ? (
          <p className={styles.suggestHidden}>{hiddenLine(hidden)}</p>
        ) : null}
      </div>

      <ul className={styles.suggestList}>
        {offered.map((c) => {
          const open = openKey === c.key;
          return (
            <li key={c.key}>
              <article className={styles.suggestCard}>
                <p className={styles.suggestText}>{c.text}</p>
                <p className={styles.suggestBasis}>{c.basis}</p>

                {/* The proposal, in its own register: a quiet framed note,
                    never the badge a captured item wears. It is labelled
                    Proposed and worded as a conditional throughout. */}
                {c.proposal ? (
                  <p className={styles.suggestProposal}>
                    <span className={styles.suggestProposalTag}>Proposed</span>
                    {linkLabel}: {c.proposal.objectiveName}
                    {c.proposal.classification
                      ? ` (${CLASSIFICATION_LABELS[
                          c.proposal.classification
                        ].toLowerCase()})`
                      : ''}
                    . Criticality would be{' '}
                    {LEVEL_LABELS[c.proposal.criticality] ?? 'Standard'}.
                  </p>
                ) : (
                  // No objective of this dimension exists on the project, so
                  // there is nothing to propose and none is invented. The tag
                  // says so rather than saying "Proposed" over a blank.
                  <p className={styles.suggestProposal}>
                    <span className={styles.suggestProposalTag}>No proposal</span>
                    This project holds no{' '}
                    {NAME_BY_TYPE[c.dimension] ?? c.dimension} objective to link
                    it to. You can add it unlinked, or link it yourself.
                  </p>
                )}

                {open ? (
                  <div className={styles.suggestConfirm}>
                    <label
                      className={styles.label}
                      htmlFor={`suggest-${c.key}-link`}
                    >
                      {linkLabel}
                    </label>
                    <select
                      id={`suggest-${c.key}-link`}
                      className={styles.select}
                      value={chosenObjectiveId}
                      onChange={(e) => setChosenObjectiveId(e.target.value)}
                    >
                      <option value="">Not linked</option>
                      {(objectives ?? [])
                        .filter((o) => o.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {NAME_BY_TYPE[o.objective_type]} (
                            {CLASSIFICATION_LABELS[o.classification]})
                          </option>
                        ))}
                    </select>
                    <p className={styles.suggestBasis}>
                      {proposalLine(confirmedStamp)}
                    </p>
                    <div className={styles.suggestActions}>
                      <button
                        type="button"
                        className={styles.suggestPrimary}
                        onClick={() => confirmAdd(c)}
                      >
                        {addLabel}
                      </button>
                      <button
                        type="button"
                        className={styles.suggestGhost}
                        onClick={cancel}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.suggestActions}>
                    <button
                      type="button"
                      className={styles.suggestPrimary}
                      onClick={() => startAdd(c)}
                      aria-label={`${addLabel}: ${c.text}`}
                    >
                      {addLabel}
                    </button>
                    <button
                      type="button"
                      className={styles.suggestGhost}
                      onClick={() => onDismiss(c)}
                      aria-label={`Dismiss: ${c.text}`}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
