import styles from './InitiationWizard.module.css';

/**
 * Step 4 in the framework, Organisation and Governance (live step 5). Who is
 * involved, who governs, and how the project reports. The workstreams that
 * deliver the project follow in their own sub-section, rendered by the shared
 * StepItemList beneath this component.
 *
 * Controlled and presentational. The parties are a repeatable list, edited
 * through their own handlers (onPartyField / onPartyAdd / onPartyRemove); the
 * scalar governance fields go through onOrgChange. The named authority is
 * picked from the parties by their stable client key, so the choice holds even
 * before a new party has been saved and given a database id; the wizard
 * resolves the key to the party's id on save.
 *
 * One party is named the authority: the single point that signs off a gate and
 * approves a re-baseline (framework Section 3). Every field is optional here;
 * completeness is a Gate 1 to 2 concern.
 */

// stakeholder_role enum values, paired with readable labels. A new party
// defaults to developer, the one party every project has.
const ROLE_OPTIONS = [
  { value: 'developer', label: 'Developer' },
  { value: 'funder', label: 'Funder' },
  { value: 'project_manager', label: 'Project manager' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' },
];

export default function StepOrganisation({
  parties,
  onPartyField,
  onPartyAdd,
  onPartyRemove,
  org,
  onOrgChange,
}) {
  const setOrg = (field) => (e) => onOrgChange(field, e.target.value);

  // Only named parties can be the authority. The select shows them by name;
  // an unnamed (blank) party is not yet a real party, so it is not offered.
  const namedParties = parties.filter((p) => p.name.trim().length > 0);
  // Guard the displayed value: if the chosen party was since blanked, fall
  // back to none rather than a dangling key.
  const authorityValue = namedParties.some((p) => p._key === org.authority_key)
    ? org.authority_key
    : '';

  return (
    <>
      <p className={styles.panelEyebrow}>Step 5 of 9</p>
      <h2 className={styles.panelHeading}>Organisation and Governance</h2>
      <p className={styles.panelIntro}>
        Set who is involved, who governs, and how the project reports, then the
        workstreams that deliver it. Every field is optional and can be revised
        before the brief is locked.
      </p>

      <div className={styles.fieldGrid}>
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Parties</h3>
          <p className={styles.groupHint}>
            The people and organisations that matter to the project, and the
            role each plays. Optional.
          </p>
        </div>

        <div className={styles.fieldFull}>
          {parties.length === 0 ? (
            <p className={styles.emptyHint}>
              No parties yet. Add one below, or continue with none.
            </p>
          ) : (
            <ul className={styles.itemList}>
              {parties.map((p, i) => (
                <li key={p._key}>
                  <fieldset className={styles.itemCard}>
                    <legend className={styles.srOnly}>Party {i + 1}</legend>
                    <div className={styles.itemHead}>
                      <span className={styles.itemIndex} aria-hidden="true">
                        Party {i + 1}
                      </span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => onPartyRemove(p._key)}
                        aria-label={`Remove party ${i + 1}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <label className={styles.label} htmlFor={`pa-${p._key}-name`}>
                          Name
                        </label>
                        <input
                          id={`pa-${p._key}-name`}
                          type="text"
                          className={styles.input}
                          value={p.name}
                          onChange={(e) => onPartyField(p._key, 'name', e.target.value)}
                          placeholder="e.g. Jane Adeyemi, or Acme Developments Ltd"
                          autoComplete="off"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`pa-${p._key}-org`}>
                          Organisation
                          <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                          id={`pa-${p._key}-org`}
                          type="text"
                          className={styles.input}
                          value={p.organisation}
                          onChange={(e) =>
                            onPartyField(p._key, 'organisation', e.target.value)
                          }
                          placeholder="e.g. Acme Developments Ltd"
                          autoComplete="off"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`pa-${p._key}-role`}>
                          Role
                        </label>
                        <select
                          id={`pa-${p._key}-role`}
                          className={styles.select}
                          value={p.role}
                          onChange={(e) => onPartyField(p._key, 'role', e.target.value)}
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <label className={styles.label} htmlFor={`pa-${p._key}-contact`}>
                          Contact
                          <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                          id={`pa-${p._key}-contact`}
                          type="text"
                          className={styles.input}
                          value={p.contact}
                          onChange={(e) =>
                            onPartyField(p._key, 'contact', e.target.value)
                          }
                          placeholder="Email or phone"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </fieldset>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className={styles.addBtn} onClick={onPartyAdd}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            Add party
          </button>
        </div>

        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Governance and reporting</h3>
          <p className={styles.groupHint}>
            Who holds the project to its baseline, and how progress is reported.
          </p>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="org-authority">
            Named authority
          </label>
          <select
            id="org-authority"
            className={styles.select}
            value={authorityValue}
            onChange={setOrg('authority_key')}
            aria-describedby="org-authority-hint"
          >
            <option value="">Not set</option>
            {namedParties.map((p) => (
              <option key={p._key} value={p._key}>
                {p.organisation ? `${p.name}, ${p.organisation}` : p.name}
              </option>
            ))}
          </select>
          <p id="org-authority-hint" className={styles.hint}>
            The single point that signs off a gate and approves a re-baseline.
            Add a party above to name one.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-cadence">
            Reporting cadence
          </label>
          <input
            id="org-cadence"
            type="text"
            className={styles.input}
            value={org.reporting_cadence}
            onChange={setOrg('reporting_cadence')}
            placeholder="e.g. Weekly, fortnightly"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-digest">
            Weekly digest recipient
          </label>
          <input
            id="org-digest"
            type="text"
            className={styles.input}
            value={org.digest_recipient}
            onChange={setOrg('digest_recipient')}
            placeholder="Who the weekly digest serves"
            autoComplete="off"
            aria-describedby="org-digest-hint"
          />
          <p id="org-digest-hint" className={styles.hint}>
            Recorded as a baseline fact.
          </p>
        </div>
      </div>
    </>
  );
}
