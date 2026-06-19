'use client';

import { useEffect, useRef } from 'react';
import { OBJECTIVE_META, CLASSIFICATION_LABELS } from './objectiveMeta';
import { CRITICALITY_OPTIONS } from './listStepConfig';
import styles from './InitiationWizard.module.css';

/**
 * StepItemList, the shared editable list behind the list steps (4, 7 and 8).
 *
 * Presentational and controlled, like the earlier steps: it owns no item
 * state. The wizard shell holds the list and the persistence; this component
 * renders whatever `items` it is given and reports every edit up through the
 * callbacks. `config` (from listStepConfig) supplies the copy and the
 * type-specific fields; the objective link selector and the Critical /
 * Standard control are common to all three steps and rendered here.
 *
 * The cascade itself lives in the shell (onLink re-applies the default
 * criticality unless the item has been manually overridden). This component
 * only surfaces the controls.
 *
 * The one piece of local behaviour is focus management: adding a row moves
 * focus to its first field, and removing a row moves focus to the Add
 * control, so keyboard and screen-reader users are never stranded. The shell
 * gives this component a key per step, so its focus bookkeeping resets when
 * the developer switches between Steps 5, 6 and 7.
 */

// Objective display name lookup, keyed by objective_type.
const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

export default function StepItemList({
  config,
  items,
  objectives,
  onField,
  onLink,
  onCriticality,
  onAdd,
  onRemove,
  // When true, render as a continuation section (a groupHead sub-heading)
  // rather than a full step header, so the list can sit under another step's
  // own header (Step 5 renders workstreams beneath Organisation and
  // Governance). sectionTitle / sectionIntro supply the sub-heading copy.
  asSection = false,
  sectionTitle,
  sectionIntro,
}) {
  // First focusable field per item, keyed by the item's stable client key.
  const firstFieldRefs = useRef(new Map());
  const addBtnRef = useRef(null);
  // The item keys at the previous render, to detect an add or a remove.
  const prevKeysRef = useRef(items.map((it) => it._key));

  useEffect(() => {
    const prev = prevKeysRef.current;
    const curr = items.map((it) => it._key);
    const added = curr.filter((k) => !prev.includes(k));

    if (added.length > 0) {
      // Focus the first field of the row just added (the last appended one).
      const el = firstFieldRefs.current.get(added[added.length - 1]);
      if (el) el.focus();
    } else if (curr.length < prev.length) {
      // A removal. Send focus to the Add control, a stable target.
      if (addBtnRef.current) addBtnRef.current.focus();
    }

    prevKeysRef.current = curr;
  }, [items]);

  const noun = config.itemNoun;
  const NounTitle = noun.charAt(0).toUpperCase() + noun.slice(1);

  // Render one type-specific field. The required (identity) field gets the
  // focus ref so a freshly added row can take focus there.
  const renderField = (field, item) => {
    const id = `${config.key}-${item._key}-${field.name}`;
    const value = item[field.name] ?? '';
    const isPrimary = field.name === config.requiredField;
    const refCb = isPrimary
      ? (el) => {
          if (el) firstFieldRefs.current.set(item._key, el);
          else firstFieldRefs.current.delete(item._key);
        }
      : undefined;
    const wrapClass = `${styles.field}${field.full ? ` ${styles.fieldFull}` : ''}`;
    const handleChange = (e) => onField(item._key, field.name, e.target.value);

    return (
      <div key={field.name} className={wrapClass}>
        <label className={styles.label} htmlFor={id}>
          {field.label}
          {field.optional && <span className={styles.optional}>(optional)</span>}
        </label>
        {field.type === 'select' ? (
          <select
            id={id}
            ref={refCb}
            className={styles.select}
            value={value}
            onChange={handleChange}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            id={id}
            ref={refCb}
            className={`${styles.textarea} ${styles.listTextarea}`}
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder}
          />
        ) : (
          <input
            id={id}
            ref={refCb}
            type={field.type === 'date' ? 'date' : 'text'}
            className={styles.input}
            value={value}
            onChange={handleChange}
            placeholder={field.type === 'date' ? undefined : field.placeholder}
            autoComplete="off"
          />
        )}
      </div>
    );
  };

  return (
    <>
      {asSection ? (
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>{sectionTitle ?? config.title}</h3>
          {(sectionIntro ?? config.intro) && (
            <p className={styles.groupHint}>{sectionIntro ?? config.intro}</p>
          )}
        </div>
      ) : (
        <>
          <p className={styles.panelEyebrow}>Step {config.step} of 9</p>
          <h2 className={styles.panelHeading}>{config.title}</h2>
          <p className={styles.panelIntro}>{config.intro}</p>
        </>
      )}

      {items.length === 0 ? (
        <p className={styles.emptyHint}>
          No {noun}s yet. Add one below, or continue with none. You can come
          back to this step before the brief is locked.
        </p>
      ) : (
        <ul className={styles.itemList}>
          {items.map((item, i) => {
            const linkId = `${config.key}-${item._key}-link`;
            const critId = `${config.key}-${item._key}-criticality`;
            return (
              <li key={item._key}>
                <fieldset className={styles.itemCard}>
                  <legend className={styles.srOnly}>
                    {NounTitle} {i + 1}
                  </legend>

                  <div className={styles.itemHead}>
                    <span className={styles.itemIndex} aria-hidden="true">
                      {NounTitle} {i + 1}
                    </span>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => onRemove(item._key)}
                      aria-label={`Remove ${noun} ${i + 1}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className={styles.itemGrid}>
                    {config.fields.map((field) => renderField(field, item))}

                    {/* Shared: link to the objective this item serves. */}
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor={linkId}>
                        Serves objective
                        <span className={styles.optional}>(optional)</span>
                      </label>
                      <select
                        id={linkId}
                        className={styles.select}
                        value={item.linked_objective_id ?? ''}
                        onChange={(e) => onLink(item._key, e.target.value)}
                      >
                        <option value="">Not linked</option>
                        {objectives.map((o) => (
                          <option key={o.id} value={o.id}>
                            {NAME_BY_TYPE[o.objective_type]} (
                            {CLASSIFICATION_LABELS[o.classification]})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Shared: cascaded, overridable criticality. */}
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor={critId}>
                        Criticality
                      </label>
                      <select
                        id={critId}
                        className={styles.select}
                        value={item.criticality}
                        onChange={(e) =>
                          onCriticality(item._key, e.target.value)
                        }
                      >
                        {CRITICALITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        ref={addBtnRef}
        className={styles.addBtn}
        onClick={onAdd}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
        {config.addLabel}
      </button>
    </>
  );
}
